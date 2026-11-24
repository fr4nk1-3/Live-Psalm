CC ?= gcc
CFLAGS ?= -O3 -Wall -Wextra -pthread
TARGET := live_psalms_engine

all: $(TARGET)

$(TARGET): live_psalms_engine.c
	$(CC) $(CFLAGS) -o $(TARGET) live_psalms_engine.c

clean:
	rm -f $(TARGET)

.PHONY: all clean
