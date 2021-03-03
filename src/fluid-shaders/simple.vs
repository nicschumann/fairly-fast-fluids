precision highp float;

attribute vec2 aPosition;

varying vec2 vUv;
varying vec2 vL;
varying vec2 vR;
varying vec2 vT;
varying vec2 vB;

uniform vec2 uTexelSize;
uniform float uAspectRatio;

void main ()
{
  vUv = aPosition * 0.5 + 0.5;
  vUv.x *= uAspectRatio;
  vUv.x -= uAspectRatio / 2.0 - 0.5;

  vL = vUv - vec2(uTexelSize.x, 0.0);
  vR = vUv + vec2(uTexelSize.x, 0.0);
  vT = vUv + vec2(0.0, uTexelSize.y);
  vB = vUv - vec2(0.0, uTexelSize.y);

  gl_Position = vec4(aPosition, 0.0, 1.0);
}
