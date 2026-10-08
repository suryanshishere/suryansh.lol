export const motion = window.matchMedia("(prefers-reduced-motion: reduce)");

// Infinite CSS loading indicators cannot be finished with the Web Animations API.
export function finishFiniteAnimations() {
  document.getAnimations().forEach((animation) => {
    if (Number.isFinite(animation.effect?.getComputedTiming().endTime))
      animation.finish();
  });
}

export const enter = (element, duration = 400, distance = 8) => {
  if (!motion.matches && element.animate)
    element.animate(
      [
        { opacity: 0, transform: `translateY(${distance}px)` },
        { opacity: 1, transform: "translateY(0)" },
      ],
      { duration, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
    );
};

// The outgoing color dissolves cell by cell, revealing the new view from
// the toggle center. All sizing is in device pixels, capped at 2x.
export const pixelWipe = (color, origin) => {
  const canvas = document.createElement("canvas");
  canvas.className = "pixel-wipe";
  canvas.setAttribute("aria-hidden", "true");
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.max(1, Math.floor(window.innerWidth * ratio));
  canvas.height = Math.max(1, Math.floor(window.innerHeight * ratio));
  const gl = canvas.getContext("webgl", {
    alpha: true,
    premultipliedAlpha: true,
    antialias: false,
  });
  if (!gl) return null;
  const shaders = [];
  let program;
  let buffer;
  const dispose = () => {
    if (buffer) gl.deleteBuffer(buffer);
    if (program) gl.deleteProgram(program);
    shaders.forEach((shader) => gl.deleteShader(shader));
    canvas.remove();
  };
  try {
    const compile = (type, source) => {
      const shader = gl.createShader(type);
      if (!shader) throw new Error("Shader unavailable");
      shaders.push(shader);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
        throw new Error("Shader compilation failed");
      return shader;
    };
    const vertex = compile(
      gl.VERTEX_SHADER,
      "attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }",
    );
    const fragment = compile(
      gl.FRAGMENT_SHADER,
      `
      precision highp float;
      uniform vec2 u_res, u_origin;
      uniform float u_prog, u_cols, u_edge;
      uniform vec3 u_color;
      float hash(vec2 cell) { return fract(sin(dot(cell, vec2(41.3, 289.1))) * 43758.5453); }
      void main() {
        vec2 uv = gl_FragCoord.xy / u_res;
        uv.y = 1.0 - uv.y;
        vec2 grid = vec2(u_cols, max(1.0, floor(u_cols / (u_res.x / u_res.y))));
        vec2 cell = floor(uv * grid);
        vec2 center = ((cell + 0.5) / grid) * u_res;
        float maxD = max(max(length(u_origin), length(u_res - u_origin)),
          max(length(vec2(u_res.x, 0.0) - u_origin), length(vec2(0.0, u_res.y) - u_origin)));
        float threshold = length(center - u_origin) / max(maxD, 1.0) + (hash(cell) - 0.5) * 0.12;
        float front = mix(-u_edge, 1.0 + u_edge, u_prog);
        float alpha = smoothstep(front - u_edge, front + u_edge, threshold);
        gl_FragColor = vec4(u_color * alpha, alpha);
      }
    `,
    );
    program = gl.createProgram();
    if (!program) throw new Error("Program unavailable");
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS))
      throw new Error("Shader linking failed");
    gl.useProgram(program);
    buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]),
      gl.STATIC_DRAW,
    );
    const position = gl.getAttribLocation(program, "p");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(
      gl.getUniformLocation(program, "u_res"),
      canvas.width,
      canvas.height,
    );
    gl.uniform2f(
      gl.getUniformLocation(program, "u_origin"),
      origin.x * ratio,
      origin.y * ratio,
    );
    const hex = parseInt(color.slice(1), 16);
    gl.uniform3f(
      gl.getUniformLocation(program, "u_color"),
      ((hex >> 16) & 255) / 255,
      ((hex >> 8) & 255) / 255,
      (hex & 255) / 255,
    );
    gl.uniform1f(gl.getUniformLocation(program, "u_cols"), 46);
    gl.uniform1f(gl.getUniformLocation(program, "u_edge"), 0.07);
    const progress = gl.getUniformLocation(program, "u_prog");
    const draw = (value) => {
      gl.uniform1f(progress, value);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };
    draw(0);
    document.body.append(canvas);
    return new Promise((resolve) => {
      let frame;
      let finished = false;
      const start = performance.now();
      const finish = () => {
        if (finished) return;
        finished = true;
        cancelAnimationFrame(frame);
        window.removeEventListener("resize", finish);
        canvas.removeEventListener("webglcontextlost", finish);
        motion.removeEventListener("change", onMotionChange);
        dispose();
        resolve();
      };
      const onMotionChange = (event) => {
        if (event.matches) finish();
      };
      const tick = (now) => {
        const value = Math.min(1, (now - start) / 780);
        draw(value * value * (3 - 2 * value));
        if (value < 1) frame = requestAnimationFrame(tick);
        else finish();
      };
      window.addEventListener("resize", finish);
      canvas.addEventListener("webglcontextlost", finish);
      motion.addEventListener("change", onMotionChange);
      frame = requestAnimationFrame(tick);
    });
  } catch {
    dispose();
    return null;
  }
};
