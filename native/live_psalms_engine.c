/*
 * live_psalms_engine.c — Native C Media, V4L2 Device & RGBA Compositor Engine
 *
 * Hybrid native backend for Live Psalms:
 *   1. Fast V4L2 (/dev/video*) + ALSA (/proc/asound/cards) device enumeration
 *   2. High-speed -O3 RGBA layer compositing & emergency blackout
 *   3. Direct binary pipe ('LPF1') -> FFmpeg RTMP / MP4 / MKV encoder bridge
 *   4. Built-in 1080p compositing throughput benchmark
 */

#define _POSIX_C_SOURCE 200809L

#include <ctype.h>
#include <errno.h>
#include <fcntl.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/stat.h>
#include <sys/types.h>
#include <time.h>
#include <unistd.h>

#ifdef __linux__
#include <linux/videodev2.h>
#include <sys/ioctl.h>
#include <sys/wait.h>
#endif

#define ENGINE_VERSION "1.0.0"
#define FRAME_MAGIC "LPF1"

typedef struct {
  uint32_t width;
  uint32_t height;
  uint32_t flags;       /* bit 0: emergency black */
  uint32_t payload_len; /* bytes of RGBA data */
} lpf_header_t;

static double now_ms(void) {
  struct timespec ts;
  clock_gettime(CLOCK_MONOTONIC, &ts);
  return (double)ts.tv_sec * 1000.0 + (double)ts.tv_nsec / 1000000.0;
}

static void json_print_escaped(const char *s) {
  putchar('"');
  for (; *s; ++s) {
    unsigned char c = (unsigned char)*s;
    if (c == '"' || c == '\\') {
      putchar('\\');
      putchar(c);
    } else if (c == '\n') {
      fputs("\\n", stdout);
    } else if (c == '\r') {
      fputs("\\r", stdout);
    } else if (c == '\t') {
      fputs("\\t", stdout);
    } else if (c >= 0x20) {
      putchar(c);
    }
  }
  putchar('"');
}

/* Fast integer RGBA alpha-over compositor: dst = src OVER dst */
static void composite_rgba_over(uint8_t *dst, const uint8_t *src, size_t pixel_count, uint8_t opacity) {
  for (size_t i = 0; i < pixel_count; ++i) {
    size_t idx = i * 4;
    uint32_t sa = ((uint32_t)src[idx + 3] * (uint32_t)opacity + 127U) / 255U;
    if (sa == 0) continue;
    if (sa == 255) {
      dst[idx + 0] = src[idx + 0];
      dst[idx + 1] = src[idx + 1];
      dst[idx + 2] = src[idx + 2];
      dst[idx + 3] = 255;
      continue;
    }
    uint32_t inv_sa = 255U - sa;
    dst[idx + 0] = (uint8_t)((src[idx + 0] * sa + dst[idx + 0] * inv_sa + 127U) / 255U);
    dst[idx + 1] = (uint8_t)((src[idx + 1] * sa + dst[idx + 1] * inv_sa + 127U) / 255U);
    dst[idx + 2] = (uint8_t)((src[idx + 2] * sa + dst[idx + 2] * inv_sa + 127U) / 255U);
    dst[idx + 3] = 255;
  }
}

static int cmd_status(void) {
  long nprocs = sysconf(_SC_NPROCESSORS_ONLN);
  if (nprocs < 1) nprocs = 1;
  int has_ffmpeg = (access("/usr/bin/ffmpeg", X_OK) == 0 || access("/usr/local/bin/ffmpeg", X_OK) == 0);
#ifdef __linux__
  int has_v4l2 = 1;
#else
  int has_v4l2 = 0;
#endif
  printf("{\"available\":true,\"engine\":\"live_psalms_engine.c\",\"version\":\"%s\","
         "\"cores\":%ld,\"v4l2\":%s,\"ffmpeg\":%s,\"pid\":%d}\n",
         ENGINE_VERSION, nprocs, has_v4l2 ? "true" : "false",
         has_ffmpeg ? "true" : "false", (int)getpid());
  return 0;
}

static int cmd_list_devices(void) {
  printf("{\"video\":[");
  int v_count = 0;

#ifdef __linux__
  for (int i = 0; i < 32; ++i) {
    char dev[32];
    snprintf(dev, sizeof(dev), "/dev/video%d", i);
    int fd = open(dev, O_RDONLY | O_NONBLOCK);
    if (fd < 0) continue;

    struct v4l2_capability cap;
    memset(&cap, 0, sizeof(cap));
    if (ioctl(fd, VIDIOC_QUERYCAP, &cap) == 0) {
      uint32_t caps = (cap.capabilities & V4L2_CAP_DEVICE_CAPS) ? cap.device_caps : cap.capabilities;
      if (caps & V4L2_CAP_VIDEO_CAPTURE) {
        if (v_count > 0) putchar(',');
        char label[128];
        snprintf(label, sizeof(label), "%s (%s)", (const char *)cap.card, dev);
        printf("{\"id\":");
        json_print_escaped(dev);
        printf(",\"label\":");
        json_print_escaped(label);
        printf("}");
        v_count++;
      }
    }
    close(fd);
  }
#endif

  printf("],\"audio\":[");
  int a_count = 0;

#ifdef __linux__
  FILE *fp = fopen("/proc/asound/cards", "r");
  if (fp) {
    char line[256];
    while (fgets(line, sizeof(line), fp)) {
      int card_idx = -1;
      char rest[200] = {0};
      if (sscanf(line, " %d [%*[^]]]: %199[^\n]", &card_idx, rest) == 2 && card_idx >= 0) {
        char id[32];
        snprintf(id, sizeof(id), "hw:%d,0", card_idx);
        if (a_count > 0) putchar(',');
        printf("{\"id\":");
        json_print_escaped(id);
        printf(",\"label\":");
        json_print_escaped(rest);
        printf("}");
        a_count++;
      }
    }
    fclose(fp);
  }
#endif

  printf("]}\n");
  return 0;
}

static int cmd_benchmark(int width, int height, int frames) {
  if (width <= 0 || height <= 0 || frames <= 0) {
    fprintf(stderr, "Invalid benchmark arguments\n");
    return 1;
  }
  size_t pixels = (size_t)width * (size_t)height;
  size_t bytes = pixels * 4;
  uint8_t *dst = (uint8_t *)malloc(bytes);
  uint8_t *src = (uint8_t *)malloc(bytes);
  if (!dst || !src) {
    free(dst);
    free(src);
    fprintf(stderr, "Out of memory\n");
    return 1;
  }
  memset(dst, 24, bytes);
  for (size_t i = 0; i < pixels; ++i) {
    src[i * 4 + 0] = (uint8_t)(i & 0xFF);
    src[i * 4 + 1] = 128;
    src[i * 4 + 2] = 220;
    src[i * 4 + 3] = 180;
  }

  double t0 = now_ms();
  for (int f = 0; f < frames; ++f) {
    composite_rgba_over(dst, src, pixels, 220);
  }
  double elapsed = now_ms() - t0;
  if (elapsed < 0.001) elapsed = 0.001;

  double fps = ((double)frames * 1000.0) / elapsed;
  double mb_per_sec = (((double)bytes * (double)frames) / (1024.0 * 1024.0)) / (elapsed / 1000.0);

  printf("{\"ok\":true,\"width\":%d,\"height\":%d,\"frames\":%d,"
         "\"elapsedMs\":%.2f,\"fps\":%.1f,\"throughputMBps\":%.1f}\n",
         width, height, frames, elapsed, fps, mb_per_sec);

  free(dst);
  free(src);
  return 0;
}

static int read_exact(int fd, void *buf, size_t len) {
  uint8_t *p = (uint8_t *)buf;
  size_t remaining = len;
  while (remaining > 0) {
    ssize_t n = read(fd, p, remaining);
    if (n == 0) return 0; /* EOF */
    if (n < 0) {
      if (errno == EINTR) continue;
      return -1;
    }
    p += n;
    remaining -= (size_t)n;
  }
  return 1;
}

static int write_exact(int fd, const void *buf, size_t len) {
  const uint8_t *p = (const uint8_t *)buf;
  size_t remaining = len;
  while (remaining > 0) {
    ssize_t n = write(fd, p, remaining);
    if (n < 0) {
      if (errno == EINTR) continue;
      return -1;
    }
    p += n;
    remaining -= (size_t)n;
  }
  return 0;
}

static int cmd_pipe(int width, int height, int fps, const char *out_target, int bitrate_kbps, const char *format) {
#ifdef __linux__
  int pipefd[2];
  if (pipe(pipefd) != 0) {
    perror("pipe");
    return 1;
  }

  pid_t pid = fork();
  if (pid < 0) {
    perror("fork");
    close(pipefd[0]);
    close(pipefd[1]);
    return 1;
  }

  if (pid == 0) {
    dup2(pipefd[0], STDIN_FILENO);
    close(pipefd[0]);
    close(pipefd[1]);

    char res_arg[32], fps_arg[16], br_arg[32], gop_arg[16];
    snprintf(res_arg, sizeof(res_arg), "%dx%d", width, height);
    snprintf(fps_arg, sizeof(fps_arg), "%d", fps);
    snprintf(br_arg, sizeof(br_arg), "%dk", bitrate_kbps);
    snprintf(gop_arg, sizeof(gop_arg), "%d", fps * 2);

    const char *fmt = (format && format[0]) ? format : "flv";
    execlp("ffmpeg", "ffmpeg",
           "-f", "rawvideo", "-pix_fmt", "rgba", "-s", res_arg, "-r", fps_arg, "-i", "pipe:0",
           "-c:v", "libx264", "-preset", "veryfast", "-tune", "zerolatency",
           "-b:v", br_arg, "-pix_fmt", "yuv420p", "-g", gop_arg,
           "-f", fmt, out_target, (char *)NULL);
    _exit(127);
  }

  close(pipefd[0]);
  size_t frame_bytes = (size_t)width * (size_t)height * 4;
  uint8_t *frame_buf = (uint8_t *)malloc(frame_bytes);
  if (!frame_buf) {
    close(pipefd[1]);
    waitpid(pid, NULL, 0);
    return 1;
  }

  for (;;) {
    char magic[4];
    int r = read_exact(STDIN_FILENO, magic, 4);
    if (r <= 0) break;
    if (memcmp(magic, FRAME_MAGIC, 4) != 0) break;

    lpf_header_t hdr;
    if (read_exact(STDIN_FILENO, &hdr, sizeof(hdr)) <= 0) break;
    if (hdr.payload_len != frame_bytes) break;
    if (read_exact(STDIN_FILENO, frame_buf, frame_bytes) <= 0) break;

    if (hdr.flags & 1U) {
      memset(frame_buf, 0, frame_bytes);
      for (size_t i = 3; i < frame_bytes; i += 4) frame_buf[i] = 255;
    }

    if (write_exact(pipefd[1], frame_buf, frame_bytes) < 0) break;
  }

  free(frame_buf);
  close(pipefd[1]);
  int status = 0;
  waitpid(pid, &status, 0);
  return WIFEXITED(status) ? WEXITSTATUS(status) : 0;
#else
  (void)width;
  (void)height;
  (void)fps;
  (void)out_target;
  (void)bitrate_kbps;
  (void)format;
  fprintf(stderr, "Pipe mode requires POSIX/Linux\n");
  return 1;
#endif
}

int main(int argc, char **argv) {
  if (argc < 2) {
    return cmd_status();
  }
  if (strcmp(argv[1], "--status") == 0) {
    return cmd_status();
  }
  if (strcmp(argv[1], "--list-devices") == 0) {
    return cmd_list_devices();
  }
  if (strcmp(argv[1], "--benchmark") == 0) {
    int w = (argc > 2) ? atoi(argv[2]) : 1920;
    int h = (argc > 3) ? atoi(argv[3]) : 1080;
    int f = (argc > 4) ? atoi(argv[4]) : 60;
    return cmd_benchmark(w, h, f);
  }
  if (strcmp(argv[1], "--pipe") == 0) {
    int w = (argc > 2) ? atoi(argv[2]) : 1920;
    int h = (argc > 3) ? atoi(argv[3]) : 1080;
    int fps = (argc > 4) ? atoi(argv[4]) : 30;
    const char *out = (argc > 5) ? argv[5] : "";
    int br = (argc > 6) ? atoi(argv[6]) : 4500;
    const char *fmt = (argc > 7) ? argv[7] : "flv";
    if (!out[0]) {
      fprintf(stderr, "Missing output target for --pipe\n");
      return 1;
    }
    return cmd_pipe(w, h, fps, out, br, fmt);
  }
  fprintf(stderr, "Unknown option: %s\n", argv[1]);
  return 1;
}
