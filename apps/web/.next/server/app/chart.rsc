1:"$Sreact.fragment"
8:I[7518,[],""]
2:T1309,
          :root {
            /* ── Core palette ── */
            --gold:        #C9A84C;
            --gold-light:  #E8C96A;
            --gold-dim:    #8A6A28;
            --gold-pale:   #F5EDD6;
            --gold-glow:   rgba(201,168,76,0.10);
            --cream:       #FAFAF7;
            --cream-2:     #F4F2EC;
            --cream-3:     #EDE9DE;
            --ink:         #1A1710;
            --ink-2:       #2E2B22;
            --ink-3:       #45412F;
            /* ── FIXED: contrast-compliant muted (was #8A8570, failed AA) ── */
            --muted:       #6B6455;
            --muted-2:     #7A7560;
            --border:      rgba(201,168,76,0.20);
            --border-2:    rgba(201,168,76,0.09);
            --panel:       #FFFFFF;
            --green:       #2E7D52;
            --green-light: #D4EDE1;
            --red:         #B5382A;
            --red-light:   #F5DDD9;
            --blue:        #1E4E8C;
            --blue-light:  #D6E4F5;
            /* ── Layout ── */
            --sidebar-w:   228px;
            --top-h:       52px;
            --radius:      10px;
            --radius-sm:   7px;
            --radius-lg:   14px;
            --shadow:      0 1px 3px rgba(26,23,16,0.06),0 1px 2px rgba(26,23,16,0.04);
            --shadow-md:   0 4px 16px rgba(26,23,16,0.08),0 1px 4px rgba(26,23,16,0.04);
            --shadow-lg:   0 8px 40px rgba(26,23,16,0.12),0 2px 8px rgba(26,23,16,0.05);
            /* ── Typography ── */
            --font-display:'Cormorant Garamond',Georgia,serif;
            --font-body:   'Outfit',system-ui,sans-serif;
            --font-mono:   'DM Mono','Fira Code',monospace;
          }

          /* ── Reset ── */
          *,*::before,*::after { box-sizing:border-box; margin:0; padding:0; }
          html { height:100%; }
          body {
            height:100%; background:var(--cream); color:var(--ink);
            font-family:var(--font-body); font-size:13px; line-height:1.55;
            -webkit-font-smoothing:antialiased; -moz-osx-font-smoothing:grayscale;
          }
          /* ── Scrollbar ── */
          ::-webkit-scrollbar { width:4px; height:4px; }
          ::-webkit-scrollbar-track { background:transparent; }
          ::-webkit-scrollbar-thumb { background:var(--cream-3); border-radius:4px; }
          ::-webkit-scrollbar-thumb:hover { background:var(--muted-2); }
          /* ── Global utility classes ── */
          .mono  { font-family:var(--font-mono); }
          .serif { font-family:var(--font-display); }
          /* ── Animations ── */
          @keyframes fadeUp  { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
          @keyframes fadeIn  { from{opacity:0} to{opacity:1} }
          @keyframes pulse   { 0%,100%{opacity:1} 50%{opacity:0.3} }
          @keyframes spin    { to{transform:rotate(360deg)} }
          @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
          .animate-in   { animation:fadeUp 0.22s ease both; }
          .animate-fade  { animation:fadeIn 0.18s ease both; }
          .spinner {
            width:18px; height:18px;
            border:2px solid var(--cream-3); border-top-color:var(--gold);
            border-radius:50%; animation:spin 0.75s linear infinite; flex-shrink:0;
          }
          /* ── Shimmer skeleton ── */
          .skeleton {
            background: linear-gradient(90deg, var(--cream-2) 25%, var(--cream-3) 50%, var(--cream-2) 75%);
            background-size:200% 100%;
            animation:shimmer 1.4s ease-in-out infinite;
            border-radius:4px;
          }
          /* ── Focus ring ── */
          :focus-visible { outline:2px solid var(--gold); outline-offset:2px; }
          /* ── Responsive: sidebar collapse at <900px ── */
          @media (max-width:900px) {
            :root { --sidebar-w:0px; }
            .sidebar { transform:translateX(-100%); position:fixed !important; z-index:200; width:228px !important; transition:transform 0.25s ease; }
            .sidebar.open { transform:translateX(0); }
            .sidebar-overlay { display:block !important; }
            .hamburger { display:flex !important; }
          }
          /* ── Responsive: 2-col grids collapse at <700px ── */
          @media (max-width:700px) {
            [data-responsive-grid] { grid-template-columns: 1fr !important; }
          }
          /* ── Scrollbar on quick-prompt chip rows ── */
          .chip-row::-webkit-scrollbar { height:0; }
          .chip-row { scrollbar-width:none; }
          .sidebar-overlay {
            display:none; position:fixed; inset:0; background:rgba(26,23,16,0.5);
            z-index:199; backdrop-filter:blur(2px);
          }
          .hamburger { display:none; }
        0:{"P":null,"b":"6xdt5aLJ0aRhMTpf7Iu-n","p":"","c":["","chart"],"i":false,"f":[[["",{"children":["chart",{"children":["__PAGE__",{}]}]},"$undefined","$undefined",true],["",["$","$1","c",{"children":[null,["$","html",null,{"lang":"en","children":[["$","head",null,{"children":[["$","meta",null,{"name":"viewport","content":"width=device-width, initial-scale=1"}],["$","link",null,{"rel":"preconnect","href":"https://fonts.googleapis.com"}],["$","link",null,{"rel":"preconnect","href":"https://fonts.gstatic.com","crossOrigin":"anonymous"}],["$","link",null,{"href":"https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;1,300;1,400&family=DM+Mono:wght@300;400;500&family=Outfit:wght@300;400;500;600;700&display=swap","rel":"stylesheet"}],["$","style",null,{"children":"$2"}]]}],"$L3"]}]]}],{"children":["chart","$L4",{"children":["__PAGE__","$L5",{},null,false]},null,false]},["$L6",[],[]],false],"$L7",false]],"m":"$undefined","G":["$8",[]],"s":false,"S":true}
9:I[1731,["882","static/chunks/882-a6f5a7e76f84dadd.js","244","static/chunks/244-f681a2e8d3117a21.js","980","static/chunks/980-abfd7a1e2020415a.js","359","static/chunks/359-b98c64a465852738.js","177","static/chunks/app/layout-dae106c83991a3dd.js"],"ErrorBoundary"]
a:I[4242,["882","static/chunks/882-a6f5a7e76f84dadd.js","244","static/chunks/244-f681a2e8d3117a21.js","980","static/chunks/980-abfd7a1e2020415a.js","359","static/chunks/359-b98c64a465852738.js","177","static/chunks/app/layout-dae106c83991a3dd.js"],"AuthProvider"]
b:I[7859,["882","static/chunks/882-a6f5a7e76f84dadd.js","244","static/chunks/244-f681a2e8d3117a21.js","980","static/chunks/980-abfd7a1e2020415a.js","359","static/chunks/359-b98c64a465852738.js","177","static/chunks/app/layout-dae106c83991a3dd.js"],"WsInitializer"]
c:I[1980,["882","static/chunks/882-a6f5a7e76f84dadd.js","244","static/chunks/244-f681a2e8d3117a21.js","980","static/chunks/980-abfd7a1e2020415a.js","359","static/chunks/359-b98c64a465852738.js","177","static/chunks/app/layout-dae106c83991a3dd.js"],"NxProviders"]
d:I[3670,[],""]
e:I[3968,["39","static/chunks/app/error-2b4383a306f2be67.js"],"default"]
f:I[1660,[],""]
10:I[6344,["882","static/chunks/882-a6f5a7e76f84dadd.js","244","static/chunks/244-f681a2e8d3117a21.js","980","static/chunks/980-abfd7a1e2020415a.js","359","static/chunks/359-b98c64a465852738.js","344","static/chunks/344-1e3354591075a39b.js","481","static/chunks/app/chart/page-a8f075436a67fc87.js"],"default"]
11:I[3613,["882","static/chunks/882-a6f5a7e76f84dadd.js","244","static/chunks/244-f681a2e8d3117a21.js","980","static/chunks/980-abfd7a1e2020415a.js","359","static/chunks/359-b98c64a465852738.js","344","static/chunks/344-1e3354591075a39b.js","481","static/chunks/app/chart/page-a8f075436a67fc87.js"],"default"]
12:I[335,[],"OutletBoundary"]
14:I[8558,[],"AsyncMetadataOutlet"]
16:I[335,[],"ViewportBoundary"]
18:I[335,[],"MetadataBoundary"]
19:"$Sreact.suspense"
3:["$","body",null,{"children":["$","$L9",null,{"children":["$","$La",null,{"children":[["$","$Lb",null,{}],["$","$Lc",null,{"children":["$","$Ld",null,{"parallelRouterKey":"children","error":"$e","errorStyles":[],"errorScripts":[],"template":["$","$Lf",null,{}],"templateStyles":"$undefined","templateScripts":"$undefined","notFound":[[["$","title",null,{"children":"404: This page could not be found."}],["$","div",null,{"style":{"fontFamily":"system-ui,\"Segoe UI\",Roboto,Helvetica,Arial,sans-serif,\"Apple Color Emoji\",\"Segoe UI Emoji\"","height":"100vh","textAlign":"center","display":"flex","flexDirection":"column","alignItems":"center","justifyContent":"center"},"children":["$","div",null,{"children":[["$","style",null,{"dangerouslySetInnerHTML":{"__html":"body{color:#000;background:#fff;margin:0}.next-error-h1{border-right:1px solid rgba(0,0,0,.3)}@media (prefers-color-scheme:dark){body{color:#fff;background:#000}.next-error-h1{border-right:1px solid rgba(255,255,255,.3)}}"}}],["$","h1",null,{"className":"next-error-h1","style":{"display":"inline-block","margin":"0 20px 0 0","padding":"0 23px 0 0","fontSize":24,"fontWeight":500,"verticalAlign":"top","lineHeight":"49px"},"children":404}],["$","div",null,{"style":{"display":"inline-block"},"children":["$","h2",null,{"style":{"fontSize":14,"fontWeight":400,"lineHeight":"49px","margin":0},"children":"This page could not be found."}]}]]}]}]],[]],"forbidden":"$undefined","unauthorized":"$undefined"}]}]]}]}]}]
4:["$","$1","c",{"children":[null,["$","$Ld",null,{"parallelRouterKey":"children","error":"$undefined","errorStyles":"$undefined","errorScripts":"$undefined","template":["$","$Lf",null,{}],"templateStyles":"$undefined","templateScripts":"$undefined","notFound":"$undefined","forbidden":"$undefined","unauthorized":"$undefined"}]]}]
5:["$","$1","c",{"children":[["$","$L10",null,{"children":["$","$L11",null,{}]}],null,["$","$L12",null,{"children":["$L13",["$","$L14",null,{"promise":"$@15"}]]}]]}]
6:["$","div","l",{"style":{"display":"flex","alignItems":"center","justifyContent":"center","minHeight":"100vh","background":"#F5F1EC"},"children":["$","div",null,{"style":{"textAlign":"center"},"children":[["$","div",null,{"style":{"width":32,"height":32,"borderRadius":"50%","border":"2px solid #E8E2DA","borderTopColor":"#C07D1A","animation":"spin 0.8s linear infinite","margin":"0 auto 12px"}}],["$","div",null,{"style":{"fontSize":12,"color":"#9C8E84","fontWeight":500},"children":"Loading…"}]]}]}]
7:["$","$1","h",{"children":[null,[["$","$L16",null,{"children":"$L17"}],null],["$","$L18",null,{"children":["$","div",null,{"hidden":true,"children":["$","$19",null,{"fallback":null,"children":"$L1a"}]}]}]]}]
17:[["$","meta","0",{"charSet":"utf-8"}],["$","meta","1",{"name":"viewport","content":"width=device-width, initial-scale=1"}]]
13:null
15:{"metadata":[["$","title","0",{"children":"NEXUS_V30 TERMINAL — The Execution Layer"}],["$","meta","1",{"name":"description","content":"Enterprise AI trading intelligence. SMC analysis, risk management, behavioral coaching."}]],"error":null,"digest":"$undefined"}
1a:"$15:metadata"
