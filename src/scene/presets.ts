import {
  createCameraElement,
  createScene,
  createShapeElement,
  createTextElement,
  SCENE_HEIGHT,
  SCENE_WIDTH,
  SceneDocument
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
      description: 'Presentation text over a dark stage.',
      canvas: {
        width: SCENE_WIDTH,
        height: SCENE_HEIGHT,
        background: { type: 'gradient', from: '#111827', to: '#020617', angle: 160 }
      },
      elements: [fullText('slide.content', 88), reference()]
    })
  );

  scenes.push(
    createScene('Presentation with lower third', {
      description: 'Slide text with a name strap along the bottom.',
      canvas: {
        width: SCENE_WIDTH,
        height: SCENE_HEIGHT,
        background: { type: 'gradient', from: '#0f172a', to: '#020617', angle: 120 }
      },
      elements: [
        createShapeElement({ name: 'Lower third bar', fill: 'rgba(8, 8, 10, 0.86)', frame: { x: 120, y: 800, width: 1120, height: 170 }, radius: 10, zIndex: 5 }),
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
          color: 'rgba(255,255,255,0.72)',
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
      description: 'Camera full frame with a name strap.',
      canvas: {
        width: SCENE_WIDTH,
        height: SCENE_HEIGHT,
        background: { type: 'solid', color: '#0b0b0e' }
      },
      elements: [
        createCameraElement({ name: 'Camera', deviceId: '', frame: { x: 0, y: 0, width: SCENE_WIDTH, height: SCENE_HEIGHT }, radius: 0, zIndex: 1 }),
        createShapeElement({ name: 'Strap', fill: 'rgba(8, 8, 10, 0.82)', frame: { x: 0, y: 840, width: 1080, height: 200 }, radius: 0, zIndex: 4 }),
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
          color: 'rgba(255,255,255,0.72)',
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
        background: { type: 'gradient', from: '#0b1220', to: '#1e1b4b', angle: 200 }
      },
      elements: [
        fullText('slide.content', 80),
        reference()
      ]
    })
  );

  scenes.push(
    createScene('Worship lyrics', {
      description: 'Large lyric text on a near-black stage.',
      canvas: {
        width: SCENE_WIDTH,
        height: SCENE_HEIGHT,
        background: { type: 'solid', color: '#07070a' }
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
          content: '10:00',
          fontSize: 150,
          fontWeight: '700',
          frame: { x: 560, y: 470, width: 800, height: 200 },
          zIndex: 2
        })
      ]
    })
  );

  return scenes;
}
