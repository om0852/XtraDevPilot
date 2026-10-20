"use client";

import { useEffect, useRef } from "react";
import SplashCursor from "./SplashCursor";

export default function CyberBackground() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const cursorRef = useRef<HTMLDivElement | null>(null);
  const ringRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let shaderMouseX = (canvas.clientWidth || 1280) / 2;
    let shaderMouseY = (canvas.clientHeight || 720) / 2;
    let clientMouseX = typeof window !== "undefined" ? window.innerWidth / 2 : 500;
    let clientMouseY = typeof window !== "undefined" ? window.innerHeight / 2 : 500;
    let currentX = clientMouseX;
    let currentY = clientMouseY;
    let ringX = clientMouseX;
    let ringY = clientMouseY;

    // WebGL Initialization
    const gl =
      canvas.getContext("webgl") ||
      (canvas.getContext("experimental-webgl") as WebGLRenderingContext | null);

    let animationFrameId: number;
    let resizeObserver: ResizeObserver | null = null;

    const vsSource = `
attribute vec2 a_position;
varying vec2 v_texCoord;
void main() {
  v_texCoord = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}`;

    const fsSource = `
precision highp float;
uniform float u_time;
uniform vec2 u_resolution;
uniform vec2 u_mouse;
varying vec2 v_texCoord;

vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }

float snoise(vec2 v) {
    const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
    vec2 i  = floor(v + dot(v, C.yy));
    vec2 x0 = v -   i + dot(i, C.xx);
    vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod289(i);
    vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
    vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
    m = m*m;
    m = m*m;
    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
    vec3 g;
    g.x  = a0.x  * x0.x  + h.x  * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
}

void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution.xy;
    vec2 mouseNorm = (u_mouse / u_resolution) - 0.5;
    
    vec2 p = (uv - 0.5) * 2.0;
    p.x *= u_resolution.x / u_resolution.y;
    p += mouseNorm * 0.15;
    
    float t = u_time * 0.18;
    
    float n1 = snoise(p * 1.3 + vec2(t * 0.3, -t * 0.2));
    float n2 = snoise(p * 2.8 - vec2(t * 0.4, t * 0.3) + n1 * 0.5);
    float n3 = snoise(p * 5.0 + vec2(sin(t * 0.5), cos(t * 0.4)));
    
    float beam1 = smoothstep(0.7, 0.0, abs(p.y + sin(p.x * 2.0 + t) * 0.25 - 0.1));
    float beam2 = smoothstep(0.8, 0.0, length(p - vec2(mouseNorm.x * 0.8, 0.2)));
    
    vec3 bg = vec3(0.043, 0.035, 0.063);
    vec3 violet = vec3(0.55, 0.25, 0.95);
    vec3 cyan = vec3(0.13, 0.82, 0.93);
    vec3 emerald = vec3(0.06, 0.72, 0.50);
    
    vec3 col = bg;
    col += violet * max(0.0, n1 * 0.32 + 0.1) * (1.0 - length(p * 0.4));
    col += cyan * max(0.0, n2 * 0.22) * smoothstep(1.5, 0.2, length(p));
    col += emerald * max(0.0, n3 * 0.12) * beam1;
    col += (violet * 0.6 + cyan * 0.4) * beam2 * 0.25;
    
    vec2 gridUV = fract(p * 8.0);
    float grid = (step(0.97, gridUV.x) + step(0.97, gridUV.y)) * 0.04;
    col += vec3(grid * 0.6, grid * 0.8, grid * 1.0);
    
    float vig = smoothstep(1.6, 0.4, length(uv - 0.5) * 1.4);
    col *= vig;
    
    gl_FragColor = vec4(col, 1.0);
}`;

    if (gl) {
      const compileShader = (type: number, src: string) => {
        const s = gl.createShader(type);
        if (!s) return null;
        gl.shaderSource(s, src);
        gl.compileShader(s);
        return s;
      };

      const vs = compileShader(gl.VERTEX_SHADER, vsSource);
      const fs = compileShader(gl.FRAGMENT_SHADER, fsSource);
      const prog = gl.createProgram();

      if (vs && fs && prog) {
        gl.attachShader(prog, vs);
        gl.attachShader(prog, fs);
        gl.linkProgram(prog);
        gl.useProgram(prog);

        const buf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.bufferData(
          gl.ARRAY_BUFFER,
          new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
          gl.STATIC_DRAW
        );

        const pos = gl.getAttribLocation(prog, "a_position");
        gl.enableVertexAttribArray(pos);
        gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);

        const uTime = gl.getUniformLocation(prog, "u_time");
        const uRes = gl.getUniformLocation(prog, "u_resolution");
        const uMouse = gl.getUniformLocation(prog, "u_mouse");

        const syncSize = () => {
          const w = canvas.clientWidth || window.innerWidth || 1280;
          const h = canvas.clientHeight || window.innerHeight || 720;
          if (canvas.width !== w || canvas.height !== h) {
            canvas.width = w;
            canvas.height = h;
          }
        };

        if (typeof ResizeObserver !== "undefined") {
          resizeObserver = new ResizeObserver(syncSize);
          resizeObserver.observe(canvas);
        }
        syncSize();

        const render = (t: number) => {
          syncSize();
          gl.viewport(0, 0, canvas.width, canvas.height);
          if (uTime) gl.uniform1f(uTime, t * 0.001);
          if (uRes) gl.uniform2f(uRes, canvas.width, canvas.height);
          if (uMouse) gl.uniform2f(uMouse, shaderMouseX, shaderMouseY);
          gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

          // Smooth lerp for main cursor aura element (fast follow)
          currentX += (clientMouseX - currentX) * 0.15;
          currentY += (clientMouseY - currentY) * 0.15;
          if (cursorRef.current) {
            cursorRef.current.style.transform = `translate3d(${currentX}px, ${currentY}px, 0) translate(-50%, -50%)`;
          }

          // Smooth delayed lerp for trailing neon ring (lagged follow)
          ringX += (clientMouseX - ringX) * 0.07;
          ringY += (clientMouseY - ringY) * 0.07;
          if (ringRef.current) {
            ringRef.current.style.transform = `translate3d(${ringX}px, ${ringY}px, 0) translate(-50%, -50%)`;
          }

          animationFrameId = requestAnimationFrame(render);
        };

        animationFrameId = requestAnimationFrame(render);
      }
    }

    // Pointer & Mouse Move Listener
    const handleMouseMove = (event: MouseEvent) => {
      clientMouseX = event.clientX;
      clientMouseY = event.clientY;

      const rect = canvas.getBoundingClientRect();
      if (rect.width && rect.height) {
        const nx = (event.clientX - rect.left) / rect.width;
        const ny = 1.0 - (event.clientY - rect.top) / rect.height;
        shaderMouseX = nx * canvas.width;
        shaderMouseY = ny * canvas.height;
      }

      // Update CSS variables for .cyber-border-card spotlight
      const pctX = (event.clientX / window.innerWidth) * 100;
      const pctY = (event.clientY / window.innerHeight) * 100;
      document.documentElement.style.setProperty("--mouse-x", `${pctX.toFixed(2)}%`);
      document.documentElement.style.setProperty("--mouse-y", `${pctY.toFixed(2)}%`);
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      if (resizeObserver) resizeObserver.disconnect();
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <>
      {/* 1. WebGL Quantum Plasma Shader */}
      <div className="fixed inset-0 w-full h-full pointer-events-none -z-20 overflow-hidden">
        <canvas
          ref={canvasRef}
          id="shader-canvas-ANIMATION_3"
          className="w-full h-full block"
        />
      </div>

      {/* 2. Cyber-Grid Overlay */}
      <div className="fixed inset-0 cyber-grid pointer-events-none -z-10 opacity-60" />

      {/* 3. Fluid Neon Ambient Spotlight Glow */}
      <div className="fixed top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[720px] h-[400px] bg-gradient-to-tr from-[#6750a4]/20 via-[#22d3ee]/15 to-transparent blur-[130px] pointer-events-none -z-10 rounded-full" />

      {/* 4. React Bits SplashCursor Fluid Hover Simulation */}
      <SplashCursor
        rainbow
        size={1}
        force={1}
        swirl={3}
        trail={1}
        clickSplash
        zIndex={1}
      />

      {/* 5. Interactive Magnetic Cursor Glow Aura (Soft Wide Field) */}
      <div
        ref={cursorRef}
        className="pointer-events-none fixed top-0 left-0 w-[550px] h-[550px] rounded-full -z-10 opacity-75"
        style={{
          background:
            "radial-gradient(circle, rgba(168, 85, 247, 0.18) 0%, rgba(34, 211, 238, 0.08) 35%, transparent 70%)",
          willChange: "transform",
        }}
      />

      {/* 6. Trailing Cyber Ring (Lagged Neon Ring Follower) */}
      <div
        ref={ringRef}
        className="pointer-events-none fixed top-0 left-0 w-24 h-24 rounded-full -z-10 border border-[#cfbcff]/25 shadow-[0_0_20px_rgba(207,188,255,0.15)]"
        style={{
          willChange: "transform",
        }}
      />
    </>
  );
}
