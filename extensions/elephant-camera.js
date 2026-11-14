// Elephant Mod - Camera Sensitivity extension
// Game-camera blocks: sensitivity-scaled mouse look, eased follow, world<->screen helpers.
(function (Scratch) {
    'use strict';

    if (!Scratch.extensions.unsandboxed) {
        throw new Error('Elephant Camera must run unsandboxed');
    }

    const {BlockType, ArgumentType} = Scratch;
    const runtime = Scratch.vm.runtime;

    const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
    const num = v => {
        const n = Number(v);
        return Number.isFinite(n) ? n : 0;
    };
    const wrapDir = d => {
        const w = ((d + 180) % 360 + 360) % 360 - 180;
        return w === -180 ? 180 : w;
    };

    const SENS_MIN = 0;
    const SENS_MAX = 500;

    const cam = {
        x: 0,
        y: 0,
        direction: 90,
        zoom: 100,
        sensitivity: 100,
        lastMouseX: null,
        lastMouseY: null
    };

    // percent -> multiplier (100% = 1x)
    const mult = () => cam.sensitivity / 100;

    class ElephantCamera {
        getInfo () {
            return {
                id: 'elephantcamera',
                name: 'Camera',
                color1: '#7A808C',
                color2: '#6B717D',
                color3: '#5B616C',
                blocks: [
                    {
                        opcode: 'setSensitivity',
                        blockType: BlockType.COMMAND,
                        text: 'set camera sensitivity to [PERCENT]%',
                        arguments: {PERCENT: {type: ArgumentType.NUMBER, defaultValue: 100}}
                    },
                    {
                        opcode: 'changeSensitivity',
                        blockType: BlockType.COMMAND,
                        text: 'change camera sensitivity by [PERCENT]',
                        arguments: {PERCENT: {type: ArgumentType.NUMBER, defaultValue: 10}}
                    },
                    {
                        opcode: 'sensitivity',
                        blockType: BlockType.REPORTER,
                        text: 'camera sensitivity'
                    },
                    '---',
                    {
                        opcode: 'lookWithMouse',
                        blockType: BlockType.COMMAND,
                        text: 'move camera with mouse movement'
                    },
                    {
                        opcode: 'moveCamera',
                        blockType: BlockType.COMMAND,
                        text: 'move camera by x: [X] y: [Y] (scaled by sensitivity)',
                        arguments: {
                            X: {type: ArgumentType.NUMBER, defaultValue: 5},
                            Y: {type: ArgumentType.NUMBER, defaultValue: 0}
                        }
                    },
                    {
                        opcode: 'turnCamera',
                        blockType: BlockType.COMMAND,
                        text: 'turn camera [DEG] degrees (scaled by sensitivity)',
                        arguments: {DEG: {type: ArgumentType.NUMBER, defaultValue: 5}}
                    },
                    {
                        opcode: 'followPoint',
                        blockType: BlockType.COMMAND,
                        text: 'ease camera toward x: [X] y: [Y]',
                        arguments: {
                            X: {type: ArgumentType.NUMBER, defaultValue: 0},
                            Y: {type: ArgumentType.NUMBER, defaultValue: 0}
                        }
                    },
                    {
                        opcode: 'setCamera',
                        blockType: BlockType.COMMAND,
                        text: 'set camera to x: [X] y: [Y] direction: [DIR]',
                        arguments: {
                            X: {type: ArgumentType.NUMBER, defaultValue: 0},
                            Y: {type: ArgumentType.NUMBER, defaultValue: 0},
                            DIR: {type: ArgumentType.NUMBER, defaultValue: 90}
                        }
                    },
                    {
                        opcode: 'setZoom',
                        blockType: BlockType.COMMAND,
                        text: 'set camera zoom to [ZOOM]%',
                        arguments: {ZOOM: {type: ArgumentType.NUMBER, defaultValue: 100}}
                    },
                    {
                        opcode: 'resetCamera',
                        blockType: BlockType.COMMAND,
                        text: 'reset camera'
                    },
                    '---',
                    {
                        opcode: 'getCam',
                        blockType: BlockType.REPORTER,
                        text: 'camera [PROP]',
                        arguments: {PROP: {type: ArgumentType.STRING, menu: 'props', defaultValue: 'x'}}
                    },
                    {
                        opcode: 'screenX',
                        blockType: BlockType.REPORTER,
                        text: 'screen x of world x: [X]',
                        arguments: {X: {type: ArgumentType.NUMBER, defaultValue: 0}}
                    },
                    {
                        opcode: 'screenY',
                        blockType: BlockType.REPORTER,
                        text: 'screen y of world y: [Y]',
                        arguments: {Y: {type: ArgumentType.NUMBER, defaultValue: 0}}
                    }
                ],
                menus: {
                    props: {
                        acceptReporters: true,
                        items: ['x', 'y', 'direction', 'zoom']
                    }
                }
            };
        }

        setSensitivity (args) {
            cam.sensitivity = clamp(num(args.PERCENT), SENS_MIN, SENS_MAX);
        }

        changeSensitivity (args) {
            cam.sensitivity = clamp(cam.sensitivity + num(args.PERCENT), SENS_MIN, SENS_MAX);
        }

        sensitivity () {
            return cam.sensitivity;
        }

        lookWithMouse () {
            const mouse = runtime.ioDevices.mouse;
            const mx = mouse.getScratchX();
            const my = mouse.getScratchY();
            if (cam.lastMouseX !== null) {
                cam.x += (mx - cam.lastMouseX) * mult();
                cam.y += (my - cam.lastMouseY) * mult();
            }
            cam.lastMouseX = mx;
            cam.lastMouseY = my;
        }

        moveCamera (args) {
            cam.x += num(args.X) * mult();
            cam.y += num(args.Y) * mult();
        }

        turnCamera (args) {
            cam.direction = wrapDir(cam.direction + num(args.DEG) * mult());
        }

        followPoint (args) {
            // Higher sensitivity = snappier. 100% closes ~10% of the gap per call.
            const t = clamp(0.1 * mult(), 0, 1);
            cam.x += (num(args.X) - cam.x) * t;
            cam.y += (num(args.Y) - cam.y) * t;
        }

        setCamera (args) {
            cam.x = num(args.X);
            cam.y = num(args.Y);
            cam.direction = wrapDir(num(args.DIR));
        }

        setZoom (args) {
            cam.zoom = clamp(num(args.ZOOM), 1, 10000);
        }

        resetCamera () {
            cam.x = 0;
            cam.y = 0;
            cam.direction = 90;
            cam.zoom = 100;
            cam.lastMouseX = null;
            cam.lastMouseY = null;
        }

        getCam (args) {
            const p = String(args.PROP).toLowerCase();
            return p in cam && p !== 'sensitivity' ? cam[p] : 0;
        }

        screenX (args) {
            return (num(args.X) - cam.x) * (cam.zoom / 100);
        }

        screenY (args) {
            return (num(args.Y) - cam.y) * (cam.zoom / 100);
        }
    }

    Scratch.extensions.register(new ElephantCamera());
}(Scratch));
