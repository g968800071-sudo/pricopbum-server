// r15 WebGL stage: post-processing (bloom, colour grading, vignette, grain, edge aberration) for every camera, plus the
// «3-е лицо» pseudo-3D chase camera: the top-down Canvas2D frame becomes the ground texture of a tilted plane and solid tiles /
// tanks are extruded into lit boxes with distance fog. If WebGL is unavailable the game keeps the pure Canvas2D path.
import { tankParts, sentryMesh, droneMesh, twinMesh, VSTRIDE } from './mesh3d.js';
const VS_Q = 'attribute vec2 p;varying vec2 v;void main(){v=p*.5+.5;gl_Position=vec4(p,0.,1.);}';
const FS_SRC = 'precision mediump float;varying vec2 v;uniform sampler2D t;uniform vec4 r;uniform vec2 px;uniform float rel;float L(vec2 q){return dot(texture2D(t,q).rgb,vec3(.299,.587,.114));}void main(){vec2 q=vec2(r.x+v.x*r.z,r.y+(1.-v.y)*r.w);vec3 c=texture2D(t,q).rgb;if(rel>0.){float dx=L(q+vec2(px.x,0.))-L(q-vec2(px.x,0.)),dy=L(q+vec2(0.,px.y))-L(q-vec2(0.,px.y));vec3 n=normalize(vec3(-dx*rel,-dy*rel,1.));float li=dot(n,normalize(vec3(-.5,-.6,.65)));c*=.8+.32*li;float sh=L(q+px*vec2(-2.5,-2.5))-L(q);c*=1.-clamp(sh*.5,0.,.18);}float lm=dot(c,vec3(.299,.587,.114));if(lm>.72)c*=(.72+(lm-.72)*.4)/lm;gl_FragColor=vec4(c,1.);}';
const FS_SKY = 'precision mediump float;varying vec2 v;uniform vec3 a;uniform vec3 b;uniform float h;void main(){float k=clamp((v.y-h)/(1.-h),0.,1.);gl_FragColor=vec4(mix(a,b,pow(k,.6)),1.);}';
const FS_BRIGHT = 'precision mediump float;varying vec2 v;uniform sampler2D t;uniform float th;void main(){vec3 c=texture2D(t,v).rgb;float l=max(c.r,max(c.g,c.b));gl_FragColor=vec4(c*smoothstep(th,1.,l),1.);}';
const FS_BLUR = 'precision mediump float;varying vec2 v;uniform sampler2D t;uniform vec2 d;void main(){vec3 c=texture2D(t,v).rgb*.227;c+=(texture2D(t,v+d*1.384).rgb+texture2D(t,v-d*1.384).rgb)*.316;c+=(texture2D(t,v+d*3.23).rgb+texture2D(t,v-d*3.23).rgb)*.07;gl_FragColor=vec4(c,1.);}';
const FS_FINAL = 'precision mediump float;varying vec2 v;uniform sampler2D s;uniform sampler2D b;uniform float bk;uniform float tm;uniform vec4 g;uniform vec3 tint;' +
  'float h(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}' +
  'void main(){vec2 c=v-.5;float r2=dot(c,c);vec2 o=c*r2*g.w;vec3 col=vec3(texture2D(s,v+o).r,texture2D(s,v).g,texture2D(s,v-o).b);' +
  'col+=texture2D(b,v).rgb*bk;col=(col-.5)*g.x+.5;float l=dot(col,vec3(.299,.587,.114));col=mix(vec3(l),col,g.y);col*=tint;' +
  'col=mix(col,col*vec3(1.04,1.,.94),smoothstep(.3,.9,l));col=mix(col,col*vec3(.92,1.,1.08),1.-smoothstep(.05,.45,l));' +
  'col*=1.-r2*g.z;col+=(h(v*vec2(913.,577.)+tm)-.5)*.035;gl_FragColor=vec4(col,1.);}';
const VS_M = 'attribute vec3 p;attribute vec3 n;attribute vec3 c;attribute float mt;attribute float tq;uniform mat4 m;uniform vec4 xf;varying vec3 w;varying vec3 lp;varying vec3 nn;varying vec3 cc;varying float vm;varying float vq;' +
  'void main(){float C=cos(xf.z),S=sin(xf.z);vec3 q=p+vec3(xf.w,0.,0.);w=vec3(xf.x+C*q.x-S*q.y,xf.y+S*q.x+C*q.y,q.z);nn=vec3(C*n.x-S*n.y,S*n.x+C*n.y,n.z);lp=q;cc=c;vm=mt;vq=tq;gl_Position=m*vec4(w,1.);}';
// r21: PBR-ish tank shading: 3-tone camo in local space, chipped edges, dust/grime, GGX spec + fresnel per material, hemisphere ambient, fog
const FS_M = 'precision highp float;varying vec3 w;varying vec3 lp;varying vec3 nn;varying vec3 cc;varying float vm;varying float vq;uniform vec3 e;uniform vec3 fc;uniform vec2 f;uniform vec3 sd;uniform vec3 sc;uniform vec3 am;uniform vec3 gc;uniform vec4 tk;uniform vec3 co;' +
  'float h(vec3 p){return fract(sin(dot(p,vec3(12.9898,78.233,37.719)))*43758.5453);}float vn(vec3 p){vec3 i=floor(p),q=fract(p);q=q*q*(3.-2.*q);return mix(mix(mix(h(i),h(i+vec3(1,0,0)),q.x),mix(h(i+vec3(0,1,0)),h(i+vec3(1,1,0)),q.x),q.y),mix(mix(h(i+vec3(0,0,1)),h(i+vec3(1,0,1)),q.x),mix(h(i+vec3(0,1,1)),h(i+vec3(1,1,1)),q.x),q.y),q.z);}' +
  'void main(){vec3 N=normalize(nn);if(!gl_FrontFacing&&false)N=-N;vec3 V=normalize(e-w);float us=tk.y,M=floor(vm+.5);vec3 P=lp/us;vec3 a=cc;float ro=.62,me=0.,em=0.;' +
  'float g1=vn(P*.9+co)*.6+vn(P*2.7)*.4;' +
  'if(M<.5){float n1=vn(P*.17+co)*.65+vn(P*.45+co)*.35,n2=vn(P*.21+co+7.3)*.7+vn(P*.6+co)*.3;vec3 br=a*vec3(.9,.72,.52)*.72,bk=a*.28+vec3(.015);a=mix(a,br,smoothstep(.56,.6,n1));a=mix(a,bk,smoothstep(.64,.68,n2));' +
  'float ch=smoothstep(.8,.86,vn(P*3.3+co.yzx));a=mix(a,vec3(.34,.33,.3),ch*tk.z);ro=mix(.6,.35,ch);a*=.9+.18*g1;}' +
  'else if(M<1.5){ro=.42;me=.55;a*=.85+.3*g1;}else if(M<2.5){ro=.88;a*=.9+.2*g1;}else if(M<3.5){ro=.06;}else if(M<4.5){ro=.55;a*=.92+.16*g1;}else if(M<5.5){em=1.;}else if(M<6.5){ro=.95;a*=.85+.3*vn(P*5.);}else if(M<7.5){ro=.3;me=.9;a=mix(a,vec3(.45,.44,.42),.4);}' +
  'else{float s=fract((vq+tk.x)/(.55*us));float gap=smoothstep(.0,.06,s)*smoothstep(.2,.14,s);a=vec3(.12,.115,.108)*(1.-.55*gap)*(.85+.3*g1);float pin=1.-smoothstep(.0,.05,abs(s-.6));a+=vec3(.12)*pin;ro=.55;me=.45;}' +
  'if(M<4.5||M>6.5){float du=smoothstep(3.,.0,P.z)*(.55+.45*vn(P*1.4));a=mix(a,vec3(.4,.35,.27),du*.6);float gr=vn(vec3(P.x*2.2,P.y*2.2,P.z*.22));a*=1.-.22*smoothstep(.55,.9,gr)*(1.-abs(N.z));' +
  'float sc2=step(vn(P*.45+co*2.),tk.w*.75);a=mix(a,a*.18+vec3(.02,.015,.01),sc2*.85);}' +
  'if(em>.5){gl_FragColor=vec4(mix(cc*1.5,fc,smoothstep(f.x,f.y,distance(w,e))*.8),1.);return;}' +
  'vec3 Ld=sd;vec3 Hv=normalize(Ld+V);float NL=max(dot(N,Ld),0.),NV=max(dot(N,V),.05),NH=max(dot(N,Hv),0.),VH=max(dot(V,Hv),0.);float al=ro*ro,dd=NH*NH*(al*al-1.)+1.,D=al*al/(3.1416*dd*dd);' +
  'vec3 F0=mix(vec3(.04),a,me);vec3 F=F0+(1.-F0)*pow(1.-VH,5.);vec3 spec=D*F*.25/max(NL*NV,.08)*NL;spec=min(spec,vec3(4.));' +
  'vec3 hemi=mix(gc,am,N.z*.5+.5);float ao=.55+.45*smoothstep(0.,4.5,P.z);vec3 R=reflect(-V,N);vec3 env=mix(gc,am*1.4,R.z*.5+.5)*(F0+(1.-F0)*pow(1.-NV,5.))*(1.-ro*.8);' +
  'vec3 col=a*(1.-me)*(hemi*ao+sc*NL)+sc*spec+env*ao;float k=smoothstep(f.x,f.y,distance(w,e))*.8;gl_FragColor=vec4(mix(col,fc,k),1.);}';
const VS_SH = 'attribute vec3 p;uniform mat4 m;uniform vec4 xf;uniform vec3 sd;void main(){float C=cos(xf.z),S=sin(xf.z);vec3 q=p+vec3(xf.w,0.,0.);vec3 w=vec3(xf.x+C*q.x-S*q.y,xf.y+S*q.x+C*q.y,q.z);w.xy-=sd.xy*w.z/sd.z;gl_Position=m*vec4(w.xy,.02,1.);}';
const FS_SH = 'precision mediump float;void main(){gl_FragColor=vec4(1.);}';
const FS_SHC = 'precision mediump float;varying vec2 v;uniform sampler2D t;uniform float k;void main(){gl_FragColor=vec4(0.,0.,0.,texture2D(t,v).r*k);}';
const VS_3D = 'attribute vec3 p;attribute float s;uniform mat4 m;uniform vec4 u;uniform vec3 e;varying vec2 v;varying float sh;varying vec3 w;void main(){v=p.xy*u.xy+u.zw;sh=s;w=p;gl_Position=m*vec4(p,1.);}';
const FS_3D = 'precision highp float;varying vec2 v;varying float sh;varying vec3 w;uniform sampler2D t;uniform sampler2D sm;uniform vec2 ss;uniform float shk;uniform vec3 fc;uniform vec2 f;uniform vec3 e;uniform vec3 sd;' +
  'float h2(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}float v2(vec2 p){vec2 i=floor(p),q=fract(p);q=q*q*(3.-2.*q);return mix(mix(h2(i),h2(i+vec2(1,0)),q.x),mix(h2(i+vec2(0,1)),h2(i+vec2(1,1)),q.x),q.y);}float fb(vec2 p){return v2(p)*.5+v2(p*2.03+3.1)*.27+v2(p*4.1+7.7)*.15+v2(p*8.3+1.3)*.08;}' +
  'void main(){float d=distance(w,e);vec2 q=clamp(v,0.,1.);vec3 tc=texture2D(t,q).rgb;float kd=floor(sh/4.+.001),s=sh-kd*4.;vec3 c;float top=step(1.,s);vec2 hp=vec2(w.x+w.y,w.z);' +
  'if(kd<.5){float n=fb(w.xy*.3);float nx=fb(w.xy*.3+vec2(.25,0.))-n,ny=fb(w.xy*.3+vec2(0.,.25))-n;vec3 Nn=normalize(vec3(-nx*3.,-ny*3.,1.));c=tc*(.8+.32*n)*(.93+.12*v2(w.xy*2.3))*(.9+.18*v2(w.xy*.05));c*=.8+.3*dot(Nn,sd);c*=1.-texture2D(sm,gl_FragCoord.xy/ss).r*shk;}' +
  'else if(kd<1.5){vec2 cc=floor(w.xy/8.),cf=fract(w.xy/8.);float hv=h2(cc),ed=min(min(cf.x,1.-cf.x),min(cf.y,1.-cf.y));vec3 cap;if(hv>.62){vec2 sb=vec2(w.x/4.+floor(w.y/2.6)*.5,w.y/2.6);vec2 sf=fract(sb)-.5;float bag=1.-smoothstep(.25,.5,length(sf*vec2(1.,1.25)));cap=vec3(.42,.37,.27)*(.55+.55*bag)*(.85+.3*fb(w.xy*1.7));}else{cap=vec3(.33,.32,.3)*(.8+.3*fb(w.xy*.8))*(.9+.2*hv);cap*=.75+.25*step(.04,fract(w.x/4.))*step(.04,fract(w.y/8.));float ck=smoothstep(.015,0.,abs(fb(w.xy*.6+hv*7.)-.5))*.4;cap*=1.-ck;float ch=smoothstep(.72,.9,v2(w.xy*.5+hv*3.));cap=mix(cap,vec3(.22,.2,.19),ch*.6);}cap*=.62+.38*smoothstep(0.,.09,ed);float row=floor(w.z/1.05);vec2 bc=vec2(floor(hp.x/2.3+row*.5),row);float bx=fract(hp.x/2.3+row*.5),by=fract(w.z/1.05);float mo=step(.05,bx)*step(.09,by);vec3 bk=vec3(.44,.26,.19)*(.75+.4*h2(bc))*(.9+.15*v2(hp*3.));bk=mix(bk,tc*.7,.15);c=mix(vec3(.5,.48,.44),bk,mo);c=mix(c,cap,top);}' +
  'else if(kd<2.5){vec2 pp=top>.5?w.xy:hp;float se=step(.04,fract(pp.x/4.))*step(.04,fract(pp.y/(top>.5?4.:5.5)));c=vec3(.34,.36,.37)*(.85+.25*fb(pp*.6));c*=.7+.3*se;float ru=smoothstep(.55,.85,v2(vec2(pp.x*1.5,pp.y*.15)))*(1.-top);c=mix(c,vec3(.38,.22,.12),ru*.55);}' +
  'else if(kd<3.5){vec2 pp=top>.5?w.xy:vec2(hp.x,w.z);float pl=floor(pp.y/1.3);float gr=v2(vec2(pp.x*.35,pp.y*7.)+pl*3.);c=vec3(.5,.38,.24)*(.72+.35*h2(vec2(pl,floor(pp.x/8.))))*(.85+.25*gr);c*=.6+.4*step(.06,fract(pp.y/1.3));vec2 fr=fract((top>.5?w.xy:vec2(hp.x,w.z*1.14))/8.);float fm=1.-step(.1,fr.x)*step(fr.x,.9)*step(.1,fr.y)*step(fr.y,.9);c=mix(c,vec3(.36,.27,.17),fm*.8);}' +
  'else{vec2 pp=top>.5?w.xy:hp;c=vec3(.45,.45,.43)*(.8+.3*fb(pp*.5))*(.75+.25*step(.03,fract(pp.x/4.)))*(.8+.2*step(.04,fract(pp.y/4.)));c=mix(c,c*.6,smoothstep(.6,.9,v2(vec2(pp.x*.8,pp.y*.12)))*(1.-top));}' +
  'if(kd>.5){c*=s<1.?s:min(s,1.05);if(top<.5)c*=.68+.32*clamp(w.z/6.,0.,1.);}float l=dot(c,vec3(.299,.587,.114));if(l>.7)c*=(.7+(l-.7)*.35)/l;' +
  'float k=smoothstep(f.x,f.y,d)*.85;if(v.x<0.||v.y<0.||v.x>1.||v.y>1.)k=max(k,.75);gl_FragColor=vec4(mix(c,fc,k),1.);}';

function mul(a, b) { const o = new Float32Array(16); for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + j] * b[i * 4 + k]; o[i * 4 + j] = s; } return o; }
function persp(fov, asp, n, f) { const t = 1 / Math.tan(fov / 2); return new Float32Array([t / asp, 0, 0, 0, 0, t, 0, 0, 0, 0, (f + n) / (n - f), -1, 0, 0, 2 * f * n / (n - f), 0]); }
function look(e, c) { // world: x right, y down (screen), z up
  let fx = c[0] - e[0], fy = c[1] - e[1], fz = c[2] - e[2]; const fl = Math.hypot(fx, fy, fz); fx /= fl; fy /= fl; fz /= fl;
  let rx = -fy, ry = fx; const rl = Math.hypot(rx, ry) || 1; rx /= rl; ry /= rl; const rz = 0;
  const ux = fy * rz - fz * ry, uy = fz * rx - fx * rz, uz = fx * ry - fy * rx; // u = f × r
  return new Float32Array([rx, ux, -fx, 0, ry, uy, -fy, 0, rz, uz, -fz, 0, -(rx * e[0] + ry * e[1] + rz * e[2]), -(ux * e[0] + uy * e[1] + uz * e[2]), fx * e[0] + fy * e[1] + fz * e[2], 1]);
}
const SOLID_H = { 1: 9, 2: 11, 6: 7, 7: 7 }; // brick, steel, crate, base (defs ids) – set in init from defs

export class GLStage {
  constructor(wrap, before, defs) {
    this.ok = false; this.cv = document.createElement('canvas'); this.cv.className = 'pcb-gl';
    let gl = null; try { gl = this.cv.getContext('webgl', { alpha: false, antialias: false, depth: true, premultipliedAlpha: false, preserveDrawingBuffer: false, powerPreference: 'high-performance' }); } catch (e) { gl = null; }
    if (!gl) return; this.gl = gl; this.D = defs; wrap.insertBefore(this.cv, before);
    this.H = { [defs.T_BRICK]: 9, [defs.T_STEEL]: 11, [defs.T_CRATE]: 7, [defs.T_BASE]: 8, 11: 10 };
    try { this.init(); this.ok = true; } catch (e) { this.ok = false; this.err = String(e && e.message || e); this.cv.remove(); }
    this.cv.addEventListener('webglcontextlost', (e) => { e.preventDefault(); this.ok = false; });
  }
  prog(vs, fs) { const gl = this.gl, mk = (t, s) => { const sh = gl.createShader(t); gl.shaderSource(sh, s); gl.compileShader(sh); if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh)); return sh; };
    const p = gl.createProgram(); gl.attachShader(p, mk(gl.VERTEX_SHADER, vs)); gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('link');
    const U = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS); for (let i = 0; i < n; i++) { const a = gl.getActiveUniform(p, i); U[a.name] = gl.getUniformLocation(p, a.name); } return { p, U, a: gl.getAttribLocation(p, 'p'), s: gl.getAttribLocation(p, 's') }; }
  init() {
    const gl = this.gl; this.P = { src: this.prog(VS_Q, FS_SRC), sky: this.prog(VS_Q, FS_SKY), br: this.prog(VS_Q, FS_BRIGHT), bl: this.prog(VS_Q, FS_BLUR), fin: this.prog(VS_Q, FS_FINAL), d3: this.prog(VS_3D, FS_3D), ms: this.prog(VS_M, FS_M), shp: this.prog(VS_SH, FS_SH), shc: this.prog(VS_Q, FS_SHC) }; const Q = this.P.ms; for (const k of ['n', 'c', 'mt', 'tq']) Q[k] = gl.getAttribLocation(Q.p, k); this.pb = new Map();
    this.quad = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, this.quad); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    this.vb = gl.createBuffer(); this.tex = this.mkTex(); this.fb = {}; this.geo = null; this.dyn = new Float32Array(4 * 6 * 4 * 64);
  }
  mkTex() { const gl = this.gl, t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v); return t; }
  target(name, w, h, depth) { const gl = this.gl; let f = this.fb[name]; if (f && f.w === w && f.h === h) return f;
    if (!f) { f = { t: this.mkTex(), f: gl.createFramebuffer(), d: depth ? gl.createRenderbuffer() : null }; this.fb[name] = f; } f.w = w; f.h = h;
    gl.bindTexture(gl.TEXTURE_2D, f.t); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, f.f); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, f.t, 0);
    if (f.d) { gl.bindRenderbuffer(gl.RENDERBUFFER, f.d); gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, w, h); gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, f.d); } return f; }
  bindOut(f, w, h) { const gl = this.gl; gl.bindFramebuffer(gl.FRAMEBUFFER, f ? f.f : null); gl.viewport(0, 0, f ? f.w : w, f ? f.h : h); }
  q(P) { const gl = this.gl; gl.useProgram(P.p); gl.bindBuffer(gl.ARRAY_BUFFER, this.quad); gl.enableVertexAttribArray(P.a); gl.vertexAttribPointer(P.a, 2, gl.FLOAT, false, 0, 0); if (P.s >= 0) gl.disableVertexAttribArray(P.s); }
  tx(unit, t) { const gl = this.gl; gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t); }
  // r19: world point -> css px inside the 3D viewport (null when behind the camera)
  project(x, y, z) { const m = this.M3, v = this.vp3; if (!m) return null; const X = m[0] * x + m[4] * y + m[8] * z + m[12], Y = m[1] * x + m[5] * y + m[9] * z + m[13], Wc = m[3] * x + m[7] * y + m[11] * z + m[15]; if (Wc <= 0.1) return null;
    return [v.x + (X / Wc * 0.5 + 0.5) * v.w, v.y + (0.5 - Y / Wc * 0.5) * v.h, Wc]; }
  resize(w, h) { if (this.cv.width !== w || this.cv.height !== h) { this.cv.width = w; this.cv.height = h; } }
  // src: the 2D canvas (world already drawn, HUD not yet). o: { mode:'flat'|'3p', quality, time, under, atmo, cam, vp, dpr, me, yaw, map, tanks }
  render(src, o) {
    const gl = this.gl; if (!this.ok || gl.isContextLost()) return false; const W = src.width, H = src.height; this.resize(W, H);
    this.tx(0, this.tex); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
    const sc = o.quality >= 0.95 ? 1 : 0.75, S = this.target('scene', Math.max(2, W * sc | 0), Math.max(2, H * sc | 0), true);
    this.bindOut(S); gl.disable(gl.DEPTH_TEST); gl.disable(gl.BLEND);
    if (o.mode === '3p' || o.mode === 'drone') this.draw3p(o, W, H, S); else { const P = this.P.src; this.q(P); this.tx(0, this.tex); gl.uniform1i(P.U.t, 0); gl.uniform4f(P.U.r, 0, 0, 1, 1); gl.uniform2f(P.U.px, 1.5 / W, 1.5 / H); gl.uniform1f(P.U.rel, o.quality >= 0.7 && o.mode === 'flat' && !o.fps ? 3.2 : 0); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); if (o.mode === 'flat' && o.meshes) this.drawFlatMeshes(o, W, H, S); }
    // bloom
    let bl = null; if (o.quality >= 0.6) { const bw = Math.max(2, W / 4 | 0), bh = Math.max(2, H / 4 | 0), A = this.target('bA', bw, bh), B = this.target('bB', bw, bh);
      this.bindOut(A); let P = this.P.br; this.q(P); this.tx(0, S.t); gl.uniform1i(P.U.t, 0); gl.uniform1f(P.U.th, o.under || o.atmo === 'night' ? 0.45 : 0.8); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      P = this.P.bl; for (let i = 0; i < 2; i++) { this.bindOut(B); this.q(P); this.tx(0, A.t); gl.uniform1i(P.U.t, 0); gl.uniform2f(P.U.d, (1 + i) / bw, 0); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        this.bindOut(A); this.q(P); this.tx(0, B.t); gl.uniform1i(P.U.t, 0); gl.uniform2f(P.U.d, 0, (1 + i) / bh); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); } bl = A; }
    this.bindOut(null, W, H); const P = this.P.fin; this.q(P); this.tx(0, S.t); this.tx(1, bl ? bl.t : S.t); gl.uniform1i(P.U.s, 0); gl.uniform1i(P.U.b, 1); gl.uniform1f(P.U.bk, bl ? (o.under || o.atmo === 'night' ? 1.15 : 0.75) : 0); gl.uniform1f(P.U.tm, (o.time * 7.3) % 100);
    const night = o.under || o.atmo === 'night'; gl.uniform4f(P.U.g, 1.12, o.atmo === 'fog' ? 0.7 : 0.8, /* r17: realistic muted grade */ o.mode === 'flat' ? 0.55 : 0.75, o.quality >= 0.95 ? 0.012 : 0);
    const T = o.atmo === 'dusk' ? [1.05, 0.96, 0.92] : o.atmo === 'snow' ? [0.84, 0.88, 0.93] : night ? [0.95, 0.98, 1.06] : [1.02, 1.0, 0.98]; gl.uniform3f(P.U.tint, T[0], T[1], T[2]);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); return true;
  }
  sunDir() { const v = [-0.45, -0.55, 0.72], l = Math.hypot(...v); return [v[0] / l, v[1] / l, v[2] / l]; } // sun from the north-west, like the 2D shadows
  partBuf(t) { const gl = this.gl, pr = tankParts(t, t._m3); let b = this.pb.get(pr.k); if (!b) { b = { pr }; for (const n of ['hull', 'tur', 'gun']) { const B = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, B); gl.bufferData(gl.ARRAY_BUFFER, pr[n], gl.STATIC_DRAW); b[n] = [B, pr[n].length / VSTRIDE]; }
      if (this.pb.size > 80) { const [k0, v0] = this.pb.entries().next().value; for (const n of ['hull', 'tur', 'gun']) gl.deleteBuffer(v0[n][0]); this.pb.delete(k0); } this.pb.set(pr.k, b); } return b; }
  // per tank: [buffer entry, [xf for hull, turret, gun]]
  xfs(t, b) { const a = t.a || 0, ta = t.ta ?? a, pv = b.pr.pv, rk = (t.recoil || 0) * 1.6, px = t.x + Math.cos(a) * pv - Math.cos(ta) * rk, py = t.y + Math.sin(a) * pv - Math.sin(ta) * rk; return [[t.x - Math.cos(ta) * rk * 0.6, t.y - Math.sin(ta) * rk * 0.6, a, 0], [px, py, ta, 0], [px, py, ta, -(t.recoil || 0) * 2.2 * b.pr.u]]; }
  // soft ground shadows: tanks (and tiles in 3D) projected along the sun into a half-res mask, then blurred
  shadowPass(o, M, list, S, W, H, vp, dpr, tiles) { const gl = this.gl, w = Math.max(2, S.w >> 1), h = Math.max(2, S.h >> 1), A = this.target('shA', w, h), B = this.target('shB', w, h), sd = this.sunDir();
    this.bindOut(A); gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT); gl.disable(gl.DEPTH_TEST); if (vp) gl.viewport(vp.x * dpr * w / W, (H - (vp.y + vp.h) * dpr) * h / H, vp.w * dpr * w / W, vp.h * dpr * h / H);
    const P = this.P.shp; gl.useProgram(P.p); gl.uniformMatrix4fv(P.U.m, false, M); gl.uniform3fv(P.U.sd, sd); gl.enableVertexAttribArray(P.a);
    if (tiles && this.geo) { gl.uniform4f(P.U.xf, 0, 0, 0, 0); gl.bindBuffer(gl.ARRAY_BUFFER, this.vb); gl.vertexAttribPointer(P.a, 3, gl.FLOAT, false, 16, 0); gl.drawArrays(gl.TRIANGLES, 0, this.geo.n); }
    for (const t of list) { const b = this.partBuf(t), X = this.xfs(t, b); ['hull', 'tur', 'gun'].forEach((n, i) => { gl.uniform4fv(P.U.xf, X[i]); gl.bindBuffer(gl.ARRAY_BUFFER, b[n][0]); gl.vertexAttribPointer(P.a, 3, gl.FLOAT, false, VSTRIDE * 4, 0); gl.drawArrays(gl.TRIANGLES, 0, b[n][1]); }); }
    const Bl = this.P.bl; for (let i = 0; i < 2; i++) { this.bindOut(B); this.q(Bl); this.tx(0, A.t); gl.uniform1i(Bl.U.t, 0); gl.uniform2f(Bl.U.d, (1.2 + i) / w, 0); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); this.bindOut(A); this.q(Bl); this.tx(0, B.t); gl.uniform1i(Bl.U.t, 0); gl.uniform2f(Bl.U.d, 0, (1.2 + i) / h); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); } }
  drawTanks(o, M, eye, fogF, fc, list, sentries) { const gl = this.gl, Q = this.P.ms, night = o.under || o.atmo === 'night'; gl.useProgram(Q.p); gl.uniformMatrix4fv(Q.U.m, false, M); gl.uniform3fv(Q.U.e, eye); gl.uniform3fv(Q.U.fc, fc); gl.uniform2fv(Q.U.f, fogF); gl.uniform3fv(Q.U.sd, this.sunDir());
    const L0 = night ? [[0.32, 0.37, 0.5], [0.16, 0.2, 0.3], [0.05, 0.05, 0.06]] : o.atmo === 'dusk' ? [[1.2, 0.82, 0.6], [0.3, 0.3, 0.4], [0.16, 0.12, 0.1]] : o.atmo === 'snow' ? [[0.95, 0.97, 1.0], [0.42, 0.47, 0.55], [0.4, 0.42, 0.45]] : o.atmo === 'fog' || o.atmo === 'rain' ? [[0.7, 0.72, 0.75], [0.4, 0.43, 0.47], [0.18, 0.18, 0.18]] : [[1.25, 1.15, 1.0], [0.34, 0.4, 0.5], [0.2, 0.17, 0.13]];
    gl.uniform3fv(Q.U.sc, L0[0]); gl.uniform3fv(Q.U.am, L0[1]); gl.uniform3fv(Q.U.gc, L0[2]);
    const at = (B) => { const st = VSTRIDE * 4; gl.bindBuffer(gl.ARRAY_BUFFER, B); gl.enableVertexAttribArray(Q.a); gl.vertexAttribPointer(Q.a, 3, gl.FLOAT, false, st, 0); gl.enableVertexAttribArray(Q.n); gl.vertexAttribPointer(Q.n, 3, gl.FLOAT, false, st, 12); gl.enableVertexAttribArray(Q.c); gl.vertexAttribPointer(Q.c, 3, gl.FLOAT, false, st, 24); gl.enableVertexAttribArray(Q.mt); gl.vertexAttribPointer(Q.mt, 1, gl.FLOAT, false, st, 36); gl.enableVertexAttribArray(Q.tq); gl.vertexAttribPointer(Q.tq, 1, gl.FLOAT, false, st, 40); };
    for (const t of list) { const b = this.partBuf(t), X = this.xfs(t, b), id = String(t.id); let hs = 0; for (let i = 0; i < id.length; i++) hs = (hs * 31 + id.charCodeAt(i)) % 997;
      gl.uniform4f(Q.U.tk, t.tread || 0, b.pr.u, 0.55, t.maxHp ? Math.max(0, 1 - t.hp / t.maxHp) : 0); gl.uniform3f(Q.U.co, hs % 13, (hs * 7) % 17, (hs * 3) % 11);
      ['hull', 'tur', 'gun'].forEach((n, i) => { gl.uniform4fv(Q.U.xf, X[i]); at(b[n][0]); gl.drawArrays(gl.TRIANGLES, 0, b[n][1]); }); }
    if (sentries && sentries.length) { const mesh = []; for (const s of sentries) if (s.dr) droneMesh(mesh, s); else if (s.tr) twinMesh(mesh, s); else sentryMesh(mesh, s); gl.uniform4f(Q.U.xf, 0, 0, 0, 0); gl.uniform4f(Q.U.tk, 0, 1, 0.3, 0); gl.uniform3f(Q.U.co, 0, 0, 0); at(this.mB || (this.mB = gl.createBuffer())); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(mesh), gl.DYNAMIC_DRAW); at(this.mB); gl.drawArrays(gl.TRIANGLES, 0, mesh.length / VSTRIDE); }
    for (const k of ['n', 'c', 'mt', 'tq']) gl.disableVertexAttribArray(Q[k]); }
  // r21: top view keeps the same 3D meshes: slightly oblique orthographic projection matching the 2D camera
  drawFlatMeshes(o, W, H, S) { const gl = this.gl, cam = o.cam, vp = o.vp, dpr = o.dpr, list = (o.tanks || []).filter(t => t.alive && t._m3 && t._m3._t === o.time); if (!list.length && !(o.sentries && o.sentries.length)) return;
    const ax = 2 * cam.z * dpr / W, ay = 2 * cam.z * dpr / H, ob = 0.22, bx = 2 * (vp.x + vp.w / 2 - cam.x * cam.z) * dpr / W - 1, by = 1 - 2 * (vp.y + vp.h / 2 - cam.y * cam.z) * dpr / H;
    const M = new Float32Array([ax, 0, 0, 0, 0, -ay, -0.0002, 0, 0, ay * ob, -0.004, 0, bx, by, 0.0002 * cam.y, 1]); this.M3 = null;
    this.shadowPass(o, M, list, S, W, H, null, dpr, false); this.bindOut(S); gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    const P = this.P.shc; this.q(P); this.tx(0, this.fb.shA.t); gl.uniform1i(P.U.t, 0); gl.uniform1f(P.U.k, o.atmo === 'night' || o.under ? 0.3 : 0.5); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); gl.disable(gl.BLEND);
    gl.enable(gl.DEPTH_TEST); gl.clear(gl.DEPTH_BUFFER_BIT); this.drawTanks(o, M, [cam.x, cam.y + 500, 1500], [1e5, 2e5], [0, 0, 0], list, o.sentries); gl.disable(gl.DEPTH_TEST); }
  // static extruded tiles around (cx,cy) – rebuilt only when the centre moves or tiles change
  buildGeo(map, cx, cy, R) {
    const C = 8, c0 = Math.max(0, Math.floor((cx - R) / C)), c1 = Math.min(map.w - 1, Math.floor((cx + R) / C)), r0 = Math.max(0, Math.floor((cy - R) / C)), r1 = Math.min(map.h - 1, Math.floor((cy + R) / C));
    const out = []; const Hh = map.under ? { ...this.H, [this.D.T_STEEL]: 16 } : this.H;
    const KIND = { [this.D.T_BRICK]: 1, [this.D.T_STEEL]: 2, [this.D.T_CRATE]: 3, [this.D.T_BASE]: 4 }; const box = (x0, y0, x1, y1, h, top, kd) => { // 5 faces: top + 4 sides with lambert-ish shading (sun from north-west)
      const f = (a, b, c, d, s0) => { const s = s0 + kd * 4; out.push(a[0], a[1], a[2], s, b[0], b[1], b[2], s, c[0], c[1], c[2], s, a[0], a[1], a[2], s, c[0], c[1], c[2], s, d[0], d[1], d[2], s); };
      f([x0, y0, h], [x1, y0, h], [x1, y1, h], [x0, y1, h], top); f([x0, y1, h], [x1, y1, h], [x1, y1, 0], [x0, y1, 0], 0.62); f([x0, y0, h], [x1, y0, h], [x1, y0, 0], [x0, y0, 0], 0.95);
      f([x0, y0, h], [x0, y1, h], [x0, y1, 0], [x0, y0, 0], 0.85); f([x1, y0, h], [x1, y1, h], [x1, y1, 0], [x1, y0, 0], 0.55); };
    for (let r = r0; r <= r1; r++) { let c = c0; while (c <= c1) { const v = map.t[r * map.w + c], h = Hh[v]; if (!h) { c++; continue; } let e = c; while (e + 1 <= c1 && map.t[r * map.w + e + 1] === v) e++;
      box(c * C, r * C, (e + 1) * C, (r + 1) * C, h, 1.08, KIND[v] || 5); c = e + 1; } }
    this.geo = { cx, cy, n: out.length / 4, map, ver: map.changes ? map.changes.length : 0 }; const gl = this.gl; gl.bindBuffer(gl.ARRAY_BUFFER, this.vb); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(out), gl.STATIC_DRAW);
  }
  draw3p(o, W, H, S) {
    const gl = this.gl, me = o.me, cam = o.cam, vp = o.vp, dpr = o.dpr, R = o.dist;
    // sky / ceiling
    const night = o.under || o.atmo === 'night'; let P = this.P.sky; this.q(P);
    const sky = o.under ? [[0.05, 0.045, 0.04], [0.02, 0.018, 0.015]] : night ? [[0.04, 0.06, 0.12], [0.01, 0.02, 0.05]] : o.atmo === 'dusk' ? [[0.95, 0.55, 0.35], [0.25, 0.2, 0.42]] : o.atmo === 'fog' || o.atmo === 'rain' ? [[0.55, 0.6, 0.63], [0.38, 0.43, 0.48]] : o.atmo === 'snow' ? [[0.8, 0.85, 0.9], [0.55, 0.62, 0.72]] : [[0.56, 0.68, 0.8], [0.25, 0.47, 0.8]]; /* r25: deeper horizon → no white haze band */
    gl.uniform3fv(P.U.a, sky[0]); gl.uniform3fv(P.U.b, sky[1]); gl.uniform1f(P.U.h, 0.45); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    if (!me) return;
    const dr = o.mode === 'drone', yaw = dr ? -Math.PI / 2 : o.yaw, fx = Math.cos(yaw), fy = Math.sin(yaw), back = dr ? 120 : o.near ? 34 : 76, up = dr ? 160 : o.near ? 22 : 74; // r27: «3-е лицо (близко)» — true close chase cam // drone: fixed north-up, ~53° tilt
    const eye = [me.x - fx * back, me.y - fy * back, up], ctr = [me.x + fx * (dr ? 20 : o.near ? 60 : 70), me.y + fy * (dr ? 20 : o.near ? 60 : 70), o.near ? 6 : 0];
    const asp = (vp.w) / (vp.h), M = mul(persp(1.05, asp, 4, R * 1.6 + 200), look(eye, ctr));
    gl.viewport(vp.x * dpr * S.w / W, (H - (vp.y + vp.h) * dpr) * S.h / H, vp.w * dpr * S.w / W, vp.h * dpr * S.h / H);
    this.M3 = M; this.vp3 = vp; gl.enable(gl.DEPTH_TEST); gl.clear(gl.DEPTH_BUFFER_BIT);
    P = this.P.d3; gl.useProgram(P.p); this.tx(0, this.tex); gl.uniform1i(P.U.t, 0); gl.uniformMatrix4fv(P.U.m, false, M);
    // world -> texture uv (the 2D frame: px = vp.x + vp.w/2 + (wx - cam.x) * z, in css px; * dpr / canvas size)
    const kx = cam.z * dpr / W, ky = cam.z * dpr / H; gl.uniform4f(P.U.u, kx, ky, (vp.x + vp.w / 2 - cam.x * cam.z) * dpr / W, (vp.y + vp.h / 2 - cam.y * cam.z) * dpr / H);
    gl.uniform3f(P.U.e, eye[0], eye[1], eye[2]); const fc = sky[0].map((c, i) => (c * 0.8 + sky[1][i] * 0.2) * 0.9); /* r25: fog = horizon colour → no flat haze band */ gl.uniform3fv(P.U.fc, fc); { const uf = o.quality >= 1.4 ? 1.6 : 1; /* r26: Ultra pushes fog back → crisp, not hazy */ gl.uniform2f(P.U.f, R * uf * (o.atmo === 'fog' ? 0.75 : 1.05), R * uf * (o.atmo === 'fog' ? 1.35 : 1.75)); } // r17: less wash-out in 3rd person
    { const g0 = this.geo, ver = o.map.changes ? o.map.changes.length : 0; if (!g0 || g0.map !== o.map || g0.ver !== ver || Math.hypot(g0.cx - me.x, g0.cy - me.y) > R * 0.35) this.buildGeo(o.map, me.x, me.y, R * 1.35); }
    // ground quad (large; uv outside the 2D frame fades into fog)
    const gq = [], gx = me.x, gy = me.y, G = R * 2.3; gq.push(gx - G, gy - G, 0, 1, gx + G, gy - G, 0, 1, gx + G, gy + G, 0, 1, gx - G, gy - G, 0, 1, gx + G, gy + G, 0, 1, gx - G, gy + G, 0, 1);
    // dynamic: tanks raised as rotated boxes (their 2D picture becomes the lid)
    const dyn = []; const tb = (t, hw = 11.2, hh = 9.6, h = 5.5, z0 = 0, ta) => { const a = (ta ?? t.a) || 0, c = Math.cos(a), s = Math.sin(a); const P4 = [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]].map(([u, w]) => [t.x + u * c - w * s, t.y + u * s + w * c]);
      const f = (A, B, Cc, Dd, sh) => dyn.push(A[0], A[1], A[2], sh, B[0], B[1], B[2], sh, Cc[0], Cc[1], Cc[2], sh, A[0], A[1], A[2], sh, Cc[0], Cc[1], Cc[2], sh, Dd[0], Dd[1], Dd[2], sh);
      const T = P4.map(p => [p[0], p[1], z0 + h]), B0 = P4.map(p => [p[0], p[1], z0]); f(T[0], T[1], T[2], T[3], 1.1); for (let i = 0; i < 4; i++) { const j = (i + 1) % 4; f(T[i], T[j], B0[j], B0[i], 0.5 + 0.12 * i); } };
    void tb; const list = o.tanks.filter(t => t.alive && t._m3 && (t.x - me.x) ** 2 + (t.y - me.y) ** 2 < R * R && !(t.inBush && t.team !== me.team) && !(t.cloaked && t.id !== me.id && t.team !== me.team));
    const sdv = this.sunDir(); this.shadowPass(o, M, list, S, W, H, vp, dpr, true);
    this.bindOut(S); gl.viewport(vp.x * dpr * S.w / W, (H - (vp.y + vp.h) * dpr) * S.h / H, vp.w * dpr * S.w / W, vp.h * dpr * S.h / H); gl.enable(gl.DEPTH_TEST);
    P = this.P.d3; gl.useProgram(P.p); this.tx(0, this.tex); this.tx(1, this.fb.shA.t); gl.uniform1i(P.U.t, 0); gl.uniform1i(P.U.sm, 1); gl.uniform2f(P.U.ss, S.w, S.h); gl.uniform1f(P.U.shk, night ? 0.25 : o.atmo === 'fog' || o.atmo === 'rain' ? 0.35 : 0.55); gl.uniform3fv(P.U.sd, sdv);
    const all = new Float32Array(gq); gl.bindBuffer(gl.ARRAY_BUFFER, this.dynB || (this.dynB = gl.createBuffer())); gl.bufferData(gl.ARRAY_BUFFER, all, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(P.a); gl.vertexAttribPointer(P.a, 3, gl.FLOAT, false, 16, 0); gl.enableVertexAttribArray(P.s); gl.vertexAttribPointer(P.s, 1, gl.FLOAT, false, 16, 12); gl.drawArrays(gl.TRIANGLES, 0, all.length / 4);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vb); gl.vertexAttribPointer(P.a, 3, gl.FLOAT, false, 16, 0); gl.vertexAttribPointer(P.s, 1, gl.FLOAT, false, 16, 12); gl.drawArrays(gl.TRIANGLES, 0, this.geo.n); gl.disableVertexAttribArray(P.s);
    this.drawTanks(o, M, eye, [R * (o.atmo === 'fog' ? 0.75 : 1.05), R * (o.atmo === 'fog' ? 1.35 : 1.75)], fc, list, o.sentries && o.sentries.filter(s => (s.x - me.x) ** 2 + (s.y - me.y) ** 2 < R * R));
    gl.disable(gl.DEPTH_TEST);
  }
}
