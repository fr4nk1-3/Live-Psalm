import type { ProjectorLayout } from '../types/presentation';
import {
  createCameraElement,
  createScene,
  createShapeElement,
  createTextElement,
  SCENE_HEIGHT,
  SCENE_WIDTH,
  SceneDocument,
  SceneElement
} from './types';

const fullText = (binding: 'slide.content' | 'slide.title', size = 84, colour = '#ffffff') =>
  createTextElement({
    name: 'Presentation text',
    binding,
    content: binding === 'slide.content' ? 'Slide text' : 'Slide title',
    fontSize: size,
    color: colour,
    frame: { x: 200, y: 300, width: SCENE_WIDTH - 400, height: 480 },
    zIndex: 2
  });

const reference = () =>
  createTextElement({
    name: 'Reference',
    binding: 'slide.reference',
    content: 'Reference',
    fontSize: 34,
    color: 'rgba(255,255,255,0.72)',
    shadow: true,
    frame: { x: 600, y: 880, width: 720, height: 80 },
    zIndex: 3
  });

/** Starting points shown in the scene library. */
export function defaultScenes(): SceneDocument[] {
  const scenes: SceneDocument[] = [];

  scenes.push(
    createScene('Full screen presentation', {
      description: 'Presentation text over the active slide background.',
      canvas: {
        width: SCENE_WIDTH,
        height: SCENE_HEIGHT,
        background: { type: 'gradient', from: '#111827', to: '#020617', angle: 160, followLiveBackground: true }
      },
      elements: [fullText('slide.content', 88), reference()]
    })
  );

  scenes.push(
    createScene('Presentation with lower third', {
      description: 'Slide text with a translucent name strap along the bottom.',
      canvas: {
        width: SCENE_WIDTH,
        height: SCENE_HEIGHT,
        background: { type: 'gradient', from: '#0f172a', to: '#020617', angle: 120, followLiveBackground: true }
      },
      elements: [
        createShapeElement({ name: 'Lower third bar', fill: 'rgba(8, 8, 14, 0.45)', frame: { x: 120, y: 800, width: 1120, height: 170 }, radius: 10, zIndex: 5 }),
        createTextElement({
          name: 'Speaker',
          content: 'Pastor name',
          fontSize: 46,
          align: 'left',
          frame: { x: 160, y: 824, width: 1040, height: 60 },
          zIndex: 6
        }),
        createTextElement({
          name: 'Role',
          content: 'Role or church',
          fontSize: 30,
          color: 'rgba(255,255,255,0.78)',
          align: 'left',
          frame: { x: 160, y: 888, width: 1040, height: 50 },
          zIndex: 6
        }),
        { ...fullText('slide.content', 64), frame: { x: 200, y: 220, width: 1520, height: 520 } }
      ]
    })
  );

  scenes.push(
    createScene('Speaker introduction', {
      description: 'Camera full frame with a translucent name strap.',
      canvas: {
        width: SCENE_WIDTH,
        height: SCENE_HEIGHT,
        background: { type: 'solid', color: '#0b0b0e' }
      },
      elements: [
        createCameraElement({ name: 'Camera', deviceId: '', frame: { x: 0, y: 0, width: SCENE_WIDTH, height: SCENE_HEIGHT }, radius: 0, zIndex: 1 }),
        createShapeElement({ name: 'Strap', fill: 'rgba(8, 8, 14, 0.45)', frame: { x: 0, y: 840, width: 1080, height: 200 }, radius: 0, zIndex: 4 }),
        createTextElement({
          name: 'Speaker',
          content: 'Pastor name',
          fontSize: 52,
          align: 'left',
          frame: { x: 80, y: 880, width: 940, height: 70 },
          zIndex: 5
        }),
        createTextElement({
          name: 'Role',
          content: 'Role or church',
          fontSize: 32,
          color: 'rgba(255,255,255,0.78)',
          align: 'left',
          frame: { x: 80, y: 950, width: 940, height: 50 },
          zIndex: 5
        })
      ]
    })
  );

  scenes.push(
    createScene('Live camera', {
      description: 'Camera only, full frame.',
      canvas: {
        width: SCENE_WIDTH,
        height: SCENE_HEIGHT,
        background: { type: 'solid', color: '#000000' }
      },
      elements: [
        createCameraElement({ name: 'Camera', deviceId: '', frame: { x: 0, y: 0, width: SCENE_WIDTH, height: SCENE_HEIGHT }, radius: 0, zIndex: 1 })
      ]
    })
  );

  scenes.push(
    createScene('Scripture display', {
      description: 'Verse text with its reference.',
      canvas: {
        width: SCENE_WIDTH,
        height: SCENE_HEIGHT,
        background: { type: 'gradient', from: '#0b1220', to: '#1e1b4b', angle: 200, followLiveBackground: true }
      },
      elements: [
        fullText('slide.content', 80),
        reference()
      ]
    })
  );

  scenes.push(
    createScene('Worship lyrics', {
      description: 'Large lyric text on the active slide background or dark stage.',
      canvas: {
        width: SCENE_WIDTH,
        height: SCENE_HEIGHT,
        background: { type: 'solid', color: '#07070a', followLiveBackground: true }
      },
      elements: [
        createTextElement({
          name: 'Lyrics',
          binding: 'slide.content',
          content: 'Lyric line',
          fontSize: 104,
          fontWeight: '700',
          frame: { x: 180, y: 280, width: 1560, height: 520 },
          zIndex: 2
        })
      ]
    })
  );

  scenes.push(
    createScene('Announcement', {
      description: 'Event card with title and detail.',
      canvas: {
        width: SCENE_WIDTH,
        height: SCENE_HEIGHT,
        background: { type: 'gradient', from: '#111827', to: '#0b1120', angle: 135 }
      },
      elements: [
        createTextElement({
          name: 'Heading',
          content: 'Announcement',
          fontSize: 96,
          fontWeight: '700',
          frame: { x: 200, y: 360, width: 1520, height: 160 },
          zIndex: 2
        }),
        createTextElement({
          name: 'Detail',
          content: 'Add the details the congregation needs.',
          fontSize: 40,
          color: 'rgba(255,255,255,0.78)',
          frame: { x: 260, y: 560, width: 1400, height: 220 },
          zIndex: 2
        })
      ]
    })
  );

  scenes.push(
    createScene('Countdown', {
      description: 'Service starts in, with the time band.',
      canvas: {
        width: SCENE_WIDTH,
        height: SCENE_HEIGHT,
        background: { type: 'gradient', from: '#020617', to: '#111827', angle: 90 }
      },
      elements: [
        createTextElement({
          name: 'Label',
          content: 'Service starts in',
          fontSize: 44,
          color: 'rgba(255,255,255,0.7)',
          frame: { x: 560, y: 380, width: 800, height: 80 },
          zIndex: 2
        }),
        createTextElement({
          name: 'Time',
          binding: 'countdown.time',
          content: '10:00',
          fontSize: 150,
          fontWeight: '700',
          frame: { x: 560, y: 470, width: 800, height: 200 },
          zIndex: 2
        })
      ]
    })
  );

  // Camera + Layout scenes: pair a live Camera element with each slide layout (all elements remain editable in SceneEditor)
  for (const camPreset of cameraLayoutScenes()) {
    scenes.push(camPreset.scene);
  }

  return scenes;
}

export const SCENE_LAYOUT_OPTIONS: { id: ProjectorLayout; label: string; description: string }[] = [
  { id: 'centered', label: 'Centered', description: 'Centered slide text with section badge and reference.' },
  { id: 'lower_third', label: 'Lower third', description: 'Translucent bottom broadcast banner with accent bar and live text.' },
  { id: 'top_banner', label: 'Top banner', description: 'Translucent top broadcast banner with accent bar and live text.' },
  { id: 'split_left', label: 'Left split', description: 'Left-hand presentation card paired with right-hand camera or stage.' },
  { id: 'split_right', label: 'Right split', description: 'Right-hand presentation card paired with left-hand camera or stage.' },
  { id: 'boxed_card', label: 'Boxed card', description: 'Centered translucent cinema card with section badge and reference.' },
  { id: 'minimal', label: 'Minimal', description: 'Distraction-free lyrics or verse text over camera or background.' }
];

const LAYOUT_SHAPE_NAMES = new Set([
  'Lower third backdrop',
  'Lower third accent bar',
  'Top banner backdrop',
  'Top banner accent bar',
  'Left split card',
  'Right split card',
  'Boxed card',
  'Strap',
  'Lower third bar'
]);

/** Best-matching camera frame and corner radius for each slide layout. */
export function cameraFrameForLayout(layout: ProjectorLayout): {
  frame: { x: number; y: number; width: number; height: number };
  radius: number;
} {
  switch (layout) {
    case 'split_left':
      return {
        frame: { x: 1010, y: 96, width: 830, height: 888 },
        radius: 28
      };
    case 'split_right':
      return {
        frame: { x: 80, y: 96, width: 830, height: 888 },
        radius: 28
      };
    default:
      return {
        frame: { x: 0, y: 0, width: SCENE_WIDTH, height: SCENE_HEIGHT },
        radius: 0
      };
  }
}

/** Builds Chris-style SceneElements (shapes + bound text elements) for any of the 7 slide layouts. */
export function buildLayoutElements(layout: ProjectorLayout): SceneElement[] {
  switch (layout) {
    case 'lower_third':
      return [
        createShapeElement({
          name: 'Lower third backdrop',
          fill: 'rgba(2, 6, 23, 0.45)',
          radius: 14,
          frame: { x: 80, y: 710, width: 1760, height: 310 },
          zIndex: 10
        }),
        createShapeElement({
          name: 'Lower third accent bar',
          fill: '#10b981',
          radius: 4,
          frame: { x: 80, y: 710, width: 14, height: 310 },
          zIndex: 11
        }),
        createTextElement({
          name: 'Slide title',
          binding: 'slide.title',
          content: '',
          fontSize: 24,
          fontWeight: '700',
          color: '#34d399',
          align: 'left',
          uppercase: true,
          frame: { x: 124, y: 724, width: 1660, height: 44 },
          zIndex: 12
        }),
        createTextElement({
          name: 'Presentation text',
          binding: 'slide.content',
          content: 'Slide text',
          fontSize: 54,
          fontWeight: '700',
          color: '#ffffff',
          align: 'left',
          frame: { x: 124, y: 772, width: 1660, height: 180 },
          zIndex: 13
        }),
        createTextElement({
          name: 'Reference',
          binding: 'slide.reference',
          content: '',
          fontSize: 24,
          color: 'rgba(226, 232, 240, 0.92)',
          align: 'left',
          frame: { x: 124, y: 958, width: 1660, height: 44 },
          zIndex: 14
        })
      ];

    case 'top_banner':
      return [
        createShapeElement({
          name: 'Top banner backdrop',
          fill: 'rgba(2, 6, 23, 0.45)',
          radius: 14,
          frame: { x: 80, y: 60, width: 1760, height: 310 },
          zIndex: 10
        }),
        createShapeElement({
          name: 'Top banner accent bar',
          fill: '#10b981',
          radius: 4,
          frame: { x: 80, y: 60, width: 14, height: 310 },
          zIndex: 11
        }),
        createTextElement({
          name: 'Slide title',
          binding: 'slide.title',
          content: '',
          fontSize: 24,
          fontWeight: '700',
          color: '#34d399',
          align: 'left',
          uppercase: true,
          frame: { x: 124, y: 74, width: 1660, height: 44 },
          zIndex: 12
        }),
        createTextElement({
          name: 'Presentation text',
          binding: 'slide.content',
          content: 'Slide text',
          fontSize: 54,
          fontWeight: '700',
          color: '#ffffff',
          align: 'left',
          frame: { x: 124, y: 122, width: 1660, height: 180 },
          zIndex: 13
        }),
        createTextElement({
          name: 'Reference',
          binding: 'slide.reference',
          content: '',
          fontSize: 24,
          color: 'rgba(226, 232, 240, 0.92)',
          align: 'left',
          frame: { x: 124, y: 308, width: 1660, height: 44 },
          zIndex: 14
        })
      ];

    case 'split_left':
      return [
        createShapeElement({
          name: 'Left split card',
          fill: 'rgba(2, 6, 23, 0.54)',
          radius: 28,
          frame: { x: 80, y: 96, width: 900, height: 888 },
          zIndex: 10
        }),
        createTextElement({
          name: 'Slide title',
          binding: 'slide.title',
          content: '',
          fontSize: 26,
          fontWeight: '700',
          color: '#34d399',
          align: 'left',
          uppercase: true,
          frame: { x: 136, y: 140, width: 788, height: 52 },
          zIndex: 11
        }),
        createTextElement({
          name: 'Presentation text',
          binding: 'slide.content',
          content: 'Slide text',
          fontSize: 68,
          fontWeight: '700',
          color: '#ffffff',
          align: 'left',
          frame: { x: 136, y: 210, width: 788, height: 660 },
          zIndex: 12
        }),
        createTextElement({
          name: 'Reference',
          binding: 'slide.reference',
          content: '',
          fontSize: 28,
          color: 'rgba(226, 232, 240, 0.85)',
          align: 'left',
          frame: { x: 136, y: 890, width: 788, height: 60 },
          zIndex: 13
        })
      ];

    case 'split_right':
      return [
        createShapeElement({
          name: 'Right split card',
          fill: 'rgba(2, 6, 23, 0.54)',
          radius: 28,
          frame: { x: 940, y: 96, width: 900, height: 888 },
          zIndex: 10
        }),
        createTextElement({
          name: 'Slide title',
          binding: 'slide.title',
          content: '',
          fontSize: 26,
          fontWeight: '700',
          color: '#34d399',
          align: 'right',
          uppercase: true,
          frame: { x: 996, y: 140, width: 788, height: 52 },
          zIndex: 11
        }),
        createTextElement({
          name: 'Presentation text',
          binding: 'slide.content',
          content: 'Slide text',
          fontSize: 68,
          fontWeight: '700',
          color: '#ffffff',
          align: 'right',
          frame: { x: 996, y: 210, width: 788, height: 660 },
          zIndex: 12
        }),
        createTextElement({
          name: 'Reference',
          binding: 'slide.reference',
          content: '',
          fontSize: 28,
          color: 'rgba(226, 232, 240, 0.85)',
          align: 'right',
          frame: { x: 996, y: 890, width: 788, height: 60 },
          zIndex: 13
        })
      ];

    case 'boxed_card':
      return [
        createShapeElement({
          name: 'Boxed card',
          fill: 'rgba(2, 6, 23, 0.52)',
          radius: 32,
          frame: { x: 160, y: 100, width: 1600, height: 880 },
          zIndex: 10
        }),
        createTextElement({
          name: 'Slide title',
          binding: 'slide.title',
          content: '',
          fontSize: 26,
          fontWeight: '700',
          color: '#34d399',
          align: 'center',
          uppercase: true,
          frame: { x: 240, y: 148, width: 1440, height: 52 },
          zIndex: 11
        }),
        createTextElement({
          name: 'Presentation text',
          binding: 'slide.content',
          content: 'Slide text',
          fontSize: 80,
          fontWeight: '700',
          color: '#ffffff',
          align: 'center',
          frame: { x: 240, y: 220, width: 1440, height: 640 },
          zIndex: 12
        }),
        createTextElement({
          name: 'Reference',
          binding: 'slide.reference',
          content: '',
          fontSize: 30,
          color: 'rgba(226, 232, 240, 0.85)',
          align: 'center',
          frame: { x: 240, y: 884, width: 1440, height: 60 },
          zIndex: 13
        })
      ];

    case 'minimal':
      return [
        createTextElement({
          name: 'Presentation text',
          binding: 'slide.content',
          content: 'Slide text',
          fontSize: 96,
          fontWeight: '700',
          color: '#ffffff',
          align: 'center',
          frame: { x: 180, y: 240, width: 1560, height: 600 },
          zIndex: 10
        })
      ];

    case 'centered':
    default:
      return [
        createTextElement({
          name: 'Slide title',
          binding: 'slide.title',
          content: '',
          fontSize: 28,
          fontWeight: '700',
          color: 'rgba(255,255,255,0.78)',
          align: 'center',
          uppercase: true,
          frame: { x: 460, y: 170, width: 1000, height: 56 },
          zIndex: 10
        }),
        fullText('slide.content', 88),
        reference()
      ];
  }
}

/**
 * Applies one of the 7 slide layouts to an existing SceneDocument, preserving
 * the scene canvas background and any cameras, media, captures, images, or
 * non-slide static elements, while automatically framing a single primary
 * camera to best match the chosen layout.
 */
export function applyLayoutToScene(scene: SceneDocument, layout: ProjectorLayout): SceneDocument {
  const hasPresentationEl = scene.elements.some(el => el.type === 'presentation');
  if (hasPresentationEl) {
    return {
      ...scene,
      layoutOverride: layout,
      updatedAt: Date.now(),
      elements: scene.elements.map(el =>
        el.type === 'presentation' ? { ...el, layout } : el
      )
    };
  }

  const kept = scene.elements.filter(el => {
    if (
      el.type === 'text' &&
      (el.binding === 'slide.content' ||
        el.binding === 'slide.title' ||
        el.binding === 'slide.reference' ||
        el.binding === 'slide.subtitle' ||
        (el.name === 'Speaker' && el.content === 'Pastor name') ||
        (el.name === 'Role' && el.content === 'Role or church'))
    ) {
      return false;
    }
    if (el.type === 'shape' && LAYOUT_SHAPE_NAMES.has(el.name)) {
      return false;
    }
    return true;
  });

  const cameraCount = kept.filter(el => el.type === 'camera').length;
  const bestCam = cameraFrameForLayout(layout);
  const adjustedKept =
    cameraCount === 1
      ? kept.map(el =>
          el.type === 'camera'
            ? {
                ...el,
                frame: { ...el.frame, ...bestCam.frame },
                radius: bestCam.radius
              }
            : el
        )
      : kept;

  const isSplit = layout === 'split_left' || layout === 'split_right';
  const hasFullFrameCamera = cameraCount > 0 && !isSplit;
  const nextBackground =
    !hasFullFrameCamera && layout === 'centered' && !scene.canvas.background.src && !scene.canvas.background.assetId
      ? { ...scene.canvas.background, followLiveBackground: true }
      : scene.canvas.background;

  return {
    ...scene,
    layoutOverride: layout,
    updatedAt: Date.now(),
    canvas: {
      ...scene.canvas,
      background: nextBackground
    },
    elements: [...adjustedKept, ...buildLayoutElements(layout)]
  };
}

/** Standalone scene presets for each of the 7 slide layouts. */
export function layoutScenes(): { id: ProjectorLayout; label: string; scene: SceneDocument }[] {
  return SCENE_LAYOUT_OPTIONS.map(opt => ({
    id: opt.id,
    label: opt.label,
    scene: createScene(`${opt.label} layout`, {
      description: opt.description,
      layoutOverride: opt.id,
      canvas: {
        width: SCENE_WIDTH,
        height: SCENE_HEIGHT,
        background: { type: 'gradient', from: '#111827', to: '#020617', angle: 160, followLiveBackground: true }
      },
      elements: buildLayoutElements(opt.id)
    })
  }));
}

/** Editable Camera + Layout scenes that pair a live Camera element with each of the 7 slide layouts. */
export function cameraLayoutScenes(): { id: ProjectorLayout; label: string; scene: SceneDocument }[] {
  const ordered: { id: ProjectorLayout; label: string; description: string }[] = [
    {
      id: 'lower_third',
      label: 'Camera + Lower third',
      description: 'Full-frame live camera with a translucent lower-third scripture/lyric strap.'
    },
    {
      id: 'top_banner',
      label: 'Camera + Top banner',
      description: 'Full-frame live camera with a translucent top broadcast banner.'
    },
    {
      id: 'split_left',
      label: 'Camera + Left split',
      description: 'Left slide presentation card paired with a right-hand live camera frame.'
    },
    {
      id: 'split_right',
      label: 'Camera + Right split',
      description: 'Left-hand live camera frame paired with a right slide presentation card.'
    },
    {
      id: 'boxed_card',
      label: 'Camera + Boxed card',
      description: 'Full-frame live camera behind a translucent centered boxed slide card.'
    },
    {
      id: 'minimal',
      label: 'Camera + Minimal',
      description: 'Full-frame live camera with clean shadowed lyrics or scripture overlay.'
    },
    {
      id: 'centered',
      label: 'Camera + Centered',
      description: 'Full-frame live camera with centered title, lyrics/scripture, and reference.'
    }
  ];

  return ordered.map(opt => {
    const camPlacement = cameraFrameForLayout(opt.id);
    const isSplit = opt.id === 'split_left' || opt.id === 'split_right';
    return {
      id: opt.id,
      label: opt.label,
      scene: createScene(opt.label, {
        description: opt.description,
        layoutOverride: opt.id,
        canvas: {
          width: SCENE_WIDTH,
          height: SCENE_HEIGHT,
          background: isSplit
            ? {
                type: 'gradient',
                from: '#0f172a',
                to: '#020617',
                angle: 145,
                followLiveBackground: true
              }
            : {
                type: 'solid',
                color: '#050508',
                followLiveBackground: false
              }
        },
        elements: [
          createCameraElement({
            name: 'Camera',
            deviceId: '',
            frame: camPlacement.frame,
            radius: camPlacement.radius,
            zIndex: 1
          }),
          ...buildLayoutElements(opt.id)
        ]
      })
    };
  });
}
