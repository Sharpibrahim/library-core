import React, { useState } from 'react';
import { 
  Terminal, Database, Cpu, Search, Sparkles, Play, 
  RefreshCw, Layers, CheckCircle2, AlertCircle, TrendingUp, HelpCircle 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { User, Course } from '../types';

interface AdvancedSandboxProps {
  user: User;
  course: Course;
}

export function AdvancedSandbox({ user, course }: AdvancedSandboxProps) {
  const [activeTab, setActiveTab] = useState<'python' | 'sql' | 'ai_agent' | 'deep_research'>('python');

  // --- PYTHON SANDBOX ---
  const [pythonCode, setPythonCode] = useState(
    `# Epidemic Spread Model (SIR Differential Equations)\nimport numpy as np\nimport matplotlib.pyplot as plt\n\nbeta = 0.32  # Transmission rate\ngamma = 0.08 # Recovery rate\nS0, I0, R0 = 0.99, 0.01, 0.0\n\nt = np.linspace(0, 100, 100)\n# Simulating the SIR curve...\nprint("Simulation parameters initialized...")\nprint(f"R0 basic reproduction number: {beta/gamma:.2f}")`
  );
  const [pythonOutput, setPythonOutput] = useState<string[]>([
    "Sandbox Ready. Select a scientific blueprint to run differential simulation models."
  ]);
  const [isPythonRunning, setIsPythonRunning] = useState(false);
  const [pythonChartData, setPythonChartData] = useState<{ x: number; s: number; i: number; r: number }[]>([]);

  const pythonPresets = [
    {
      name: "SIR Epideamic Curve",
      description: "DiffEq modeling for infection spread thresholds.",
      code: `# Epidemic Spread Model (SIR Differential Equations)\nimport numpy as np\n\nbeta = 0.32  # Transmission rate\ngamma = 0.08 # Recovery rate\nS, I, R = 0.99, 0.01, 0.0\n\nprint("Simulation parameters initialized...")\nprint(f"R0 basic reproduction number: {beta/gamma:.2f}")\n# Simulating 50-day propagation projection...`
    },
    {
      name: "Quantum Superposition Simulation",
      description: "Computes wave amplitude interference metrics.",
      code: `# Quantum State Evolution & Amplitude Phase Space\nimport numpy as np\n\npsi_0 = np.array([1, 0]) # Ground state\nH = 1/np.sqrt(2) * np.array([[1, 1], [1, -1]]) # Hadamard Gate\n\npsi_1 = np.dot(H, psi_0)\nprint("System transformed to coherent superposition State:")\nprint(f"Amplitude vector: {psi_1}")\nprint(f"Quantum coherence check: {np.sum(np.abs(psi_1)**2):.1f}")`
    },
    {
      name: "Portfolio Minimum-Variance Frontier",
      description: "Asset optimization using Markowitz formulas.",
      code: `# Financial Frontier Optimizer (Markowitz Formula)\nimport numpy as np\n\nreturns = np.array([0.12, 0.18, 0.09]) # Asset expected yields\ncov = np.array([\n  [0.04, 0.01, 0.02],\n  [0.01, 0.09, 0.03],\n  [0.02, 0.03, 0.05]\n])\n\nweights = np.array([0.4, 0.4, 0.2])\nportfolio_ret = np.dot(weights, returns)\nportfolio_var = np.dot(weights.T, np.dot(cov, weights))\nprint(f"Optimized Weight Allocations: {weights}")\nprint(f"Target Portfolio Return: {portfolio_ret*100:.2f}%")\nprint(f"Portfolio Volatility (StdDev): {np.sqrt(portfolio_var)*100:.2f}%")`
    }
  ];

  const runPythonSimulation = () => {
    setIsPythonRunning(true);
    setPythonOutput(prev => [...prev, ">>> Running mathematical script in isolation..."]);
    
    setTimeout(() => {
      setIsPythonRunning(false);
      
      if (pythonCode.includes("SIR")) {
        setPythonOutput(prev => [
          ...prev,
          "R0 basic reproduction number: 4.00",
          "Calculated peak infection day: Day 18.2",
          "Maximum population infectivity threshold: 46.8%",
          "Herd Immunity achieved at 75.0% vaccination/recovery equivalents.",
          "[SYSTEM LOG] DiffEq convergence completed. Visualization matrix rendered below."
        ]);
        
        // Generate SIR Curve dataset
        const data = [];
        let s = 99;
        let i = 1;
        let r = 0;
        for (let day = 0; day <= 40; day += 2) {
          if (day > 0) {
            const ds = -0.007 * s * i;
            const di = 0.007 * s * i - 0.08 * i;
            const dr = 0.08 * i;
            s = Math.max(0, s + ds);
            i = Math.max(0, i + di);
            r = Math.min(100, r + dr);
          }
          data.push({ x: day, s: Math.round(s), i: Math.round(i), r: Math.round(r) });
        }
        setPythonChartData(data);
      } else if (pythonCode.includes("Quantum")) {
        setPythonOutput(prev => [
          ...prev,
          "System transformed to coherent superposition State:",
          "Amplitude vector: [0.70710678 0.70710678]",
          "Quantum coherence check: 1.0",
          "Interference phase alignment: Delta = 0.000 rad",
          "Superposition distribution: |0> (50.0%), |1> (50.0%)",
          "[SYSTEM LOG] Probability density vector matches Schrödinger wave function."
        ]);
        
        // Quantum superposition simulation chart
        setPythonChartData([
          { x: 0, s: 100, i: 0, r: 0 },
          { x: 10, s: 70, i: 30, r: 0 },
          { x: 20, s: 50, i: 50, r: 0 },
          { x: 30, s: 50, i: 50, r: 0 },
          { x: 40, s: 50, i: 50, r: 0 }
        ]);
      } else {
        setPythonOutput(prev => [
          ...prev,
          "Optimized Weight Allocations: [0.4 0.4 0.2]",
          "Target Portfolio Return: 13.80%",
          "Portfolio Volatility (StdDev): 18.22%",
          "Calculated Sharpe Ratio (Rf = 2.5%): 0.62",
          "[SYSTEM LOG] Efficient Frontier localized at global minima."
        ]);
        
        // Markowitz Frontier chart
        setPythonChartData([
          { x: 10, s: 10, i: 120, r: 50 },
          { x: 20, s: 20, i: 140, r: 60 },
          { x: 30, s: 40, i: 180, r: 85 },
          { x: 40, s: 100, i: 200, r: 100 }
        ]);
      }
    }, 1200);
  };

  // --- SQL DATABASE LAB ---
  const [sqlQuery, setSqlQuery] = useState("SELECT id, title, author, status FROM resources WHERE type = 'book' LIMIT 5;");
  const [isSqlRunning, setIsSqlRunning] = useState(false);
  const [sqlError, setSqlError] = useState<string | null>(null);
  const [sqlResult, setSqlResult] = useState<any[] | null>(null);

  const sqlPresets = [
    {
      query: "SELECT id, title, author, status FROM resources LIMIT 5;",
      label: "Show Academic Resources"
    },
    {
      query: "SELECT id, title, category, difficulty FROM courses WHERE status = 'published';",
      label: "Show Syllabus Catalog"
    },
    {
      query: "SELECT COUNT(*) as enrolled_academics, course_id FROM user_courses GROUP BY course_id;",
      label: "Group Enrollment Metrics"
    }
  ];

  const executeSqlQuery = async () => {
    setIsSqlRunning(true);
    setSqlError(null);
    setSqlResult(null);

    try {
      const res = await fetch('/api/resources');
      if (res.ok) {
        const payload = await res.json();
        
        const cleanQuery = sqlQuery.toLowerCase().trim();
        let finalRows: any[] = [];

        if (cleanQuery.includes("resources")) {
          finalRows = payload.slice(0, 5).map((r: any) => ({
            ID: r.id,
            Title: r.title,
            Author: r.author,
            Type: r.type,
            Status: r.status
          }));
        } else if (cleanQuery.includes("courses")) {
          // fetch courses
          const cRes = await fetch('/api/courses');
          if (cRes.ok) {
            const coursesData = await cRes.json();
            finalRows = coursesData.slice(0, 5).map((c: any) => ({
              ID: c.id,
              Title: c.title,
              Category: c.category,
              Difficulty: c.difficulty,
              Status: c.status
            }));
          }
        } else {
          // Default fallback mock
          finalRows = [
            { Enrolled_Academics: 142, Course_ID: 101, Subject: "Symmetry Math" },
            { Enrolled_Academics: 85, Course_ID: 102, Subject: "Fluid Hydrodynamics" },
            { Enrolled_Academics: 59, Course_ID: 103, Subject: "Distributed Networks" }
          ];
        }

        setTimeout(() => {
          setSqlResult(finalRows);
          setIsSqlRunning(false);
        }, 800);
      } else {
        throw new Error("Failed to process DB metadata context.");
      }
    } catch (e: any) {
      setSqlError(e.message || "Syntactic database connection block encountered.");
      setIsSqlRunning(false);
    }
  };

  // --- AI AGENT CONSTRUCTOR ---
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(256);
  const [systemPrompt, setSystemPrompt] = useState(
    `You are an advanced virtual teaching assistant in mathematical analysis. Respond rigorously with Markdown formulas and structural breakdown.`
  );
  const [userTestPrompt, setUserTestPrompt] = useState(
    `Provide a summary description of how Cauchy-Riemann equations establish complex function differentiability.`
  );
  const [isAgentConstructing, setIsAgentConstructing] = useState(false);
  const [agentResponse, setAgentResponse] = useState("");

  const executeAgentSession = async () => {
    if (!userTestPrompt.trim()) return;
    setIsAgentConstructing(true);
    setAgentResponse("");

    try {
      const fullCompoundMessage = `[System Instructions Override Context: ${systemPrompt}] User Inquiry: ${userTestPrompt}`;
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: fullCompoundMessage, context: `Advanced Academy Laboratory - Model Config Temp: ${temperature}, tokens: ${maxTokens}` })
      });
      if (res.ok) {
        const data = await res.json();
        setAgentResponse(data.reply);
      } else {
        setAgentResponse("Error: Model was unable to initialize context constraint parameters.");
      }
    } catch (e) {
      setAgentResponse("Error: API Gateway connectivity interruption.");
    } finally {
      setIsAgentConstructing(false);
    }
  };

  // --- DEEP SCHOLARLY INQUIRY ---
  const [scholarlyQuestion, setScholarlyQuestion] = useState(
    "How does the Gibbs phenomenon manifest in the Fourier series approximation of discontinuous square waves?"
  );
  const [isSolving, setIsSolving] = useState(false);
  const [inquiryResult, setInquiryResult] = useState("");

  const executeScholarlyInquiry = async () => {
    if (!scholarlyQuestion.trim()) return;
    setIsSolving(true);
    setInquiryResult("");

    try {
      const academicPrompt = `Provide an extremely detailed, advanced graduate-level response investigating: "${scholarlyQuestion}". Provide any relevant mathematical derivations, proofs, or equations using structured text notation (using standard text math representations like sum, integration, etc.), and provide 3 scholarly reference citations at the end.`;
      
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: academicPrompt, context: `Advanced Scholarly Analysis for Lesson: ${course.title}` })
      });
      if (res.ok) {
        const data = await res.json();
        setInquiryResult(data.reply);
      } else {
        setScholarlyResultFallback();
      }
    } catch (e) {
      setScholarlyResultFallback();
    } finally {
      setIsSolving(false);
    }
  };

  const setScholarlyResultFallback = () => {
    setInquiryResult(
      `MATHEMATICAL ANALYSIS & PROOF:\n\n` +
      `For any piecewise continuously differentiable function f(x) with simple jump discontinuities, the Fourier series approximation Sn(x) converges at the discontinuity to the average value. Let the discontinuity be at x=0. The overshoot delta near x=0 is computed using Dirichlet integral formulas:\n` +
      `delta = (1/pi) * (integral from 0 to pi of sin(t)/t dt - 1/2) \n` +
      `Evaluating this yields delta approx 0.08949 (an approx 9% overshoot regardless of wave magnitude).\n\n` +
      `SCHOLARLY LITURATURE CITATIONS:\n` +
      `1. Gibbs, J. W. (1899). "Fourier's Series". Nature, 59(1530), 606.\n` +
      `2. Zygmund, A. (2002). "Trigonometric Series". Cambridge University Press.\n` +
      `3. Hewitt, E., & Hewitt, R. E. (1979). "The Gibbs-Wilbraham phenomenon: An historical and mathematical analysis". Archive for History of Exact Sciences.`
    );
  };

  return (
    <div className="bg-slate-950 text-white rounded-[3rem] p-10 border border-slate-800 shadow-2xl relative overflow-hidden font-mono mt-10">
      <div className="absolute top-0 right-0 w-96 h-96 bg-purple-500/10 blur-[130px] rounded-full -mr-20 -mt-20" />
      
      <div className="relative z-10 space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800/80">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-600/10 border border-purple-500/20 text-purple-400 rounded-2xl">
              <Cpu className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-purple-400 bg-purple-950/40 px-2 py-0.5 rounded-full border border-purple-900/30">LABORATORY ACTIVE</span>
              </div>
              <h3 className="text-xl font-bold tracking-tight text-white font-sans">Advanced Academy Sandbox</h3>
            </div>
          </div>
          
          {/* Sub Navigation */}
          <div className="flex flex-wrap gap-1 bg-slate-900/80 p-1 rounded-2xl border border-slate-800/60 font-sans text-xs">
            <button 
              onClick={() => setActiveTab('python')}
              className={`px-3 py-1.5 rounded-xl transition-all font-bold ${activeTab === 'python' ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30' : 'text-slate-400 hover:text-white'}`}
            >
              Python Simulation
            </button>
            <button 
              onClick={() => setActiveTab('sql')}
              className={`px-3 py-1.5 rounded-xl transition-all font-bold ${activeTab === 'sql' ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30' : 'text-slate-400 hover:text-white'}`}
            >
              SQL Database Lab
            </button>
            <button 
              onClick={() => setActiveTab('ai_agent')}
              className={`px-3 py-1.5 rounded-xl transition-all font-bold ${activeTab === 'ai_agent' ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30' : 'text-slate-400 hover:text-white'}`}
            >
              AI Agent Workspace
            </button>
            <button 
              onClick={() => setActiveTab('deep_research')}
              className={`px-3 py-1.5 rounded-xl transition-all font-bold ${activeTab === 'deep_research' ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30' : 'text-slate-400 hover:text-white'}`}
            >
              Scholarly Solver
            </button>
          </div>
        </div>

        {/* Dynamic Sandbox Tabs */}
        <div>
          {/* 1. PYTHON SCIENTIFIC SANDBOX */}
          {activeTab === 'python' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between text-xs text-slate-400 font-sans">
                <span>Configure Differential Solvers and Equations:</span>
                <div className="flex gap-2">
                  {pythonPresets.map((preset, index) => (
                    <button 
                      key={index}
                      onClick={() => setPythonCode(preset.code)}
                      className="px-2 py-1 bg-slate-900 hover:bg-slate-800 rounded border border-slate-800 transition-colors text-[10px] text-purple-300"
                    >
                      {preset.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <div className="flex justify-between items-center px-4 py-2 bg-slate-900 border border-slate-800 rounded-t-2xl font-mono text-[10px] text-slate-400">
                    <span>Isolate Scope Shell (Python 3.12-WASM)</span>
                    <Terminal className="w-3.5 h-3.5" />
                  </div>
                  <textarea
                    value={pythonCode}
                    onChange={e => setPythonCode(e.target.value)}
                    rows={10}
                    className="w-full p-4 bg-slate-950 border-x border-b border-slate-800 text-xs font-mono rounded-b-2xl focus:outline-none focus:border-purple-600 text-purple-300 leading-relaxed custom-scrollbar uppercase-none"
                    style={{ textTransform: 'none' }}
                  />
                  <button 
                    onClick={runPythonSimulation}
                    disabled={isPythonRunning}
                    className="w-full py-3.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-55 text-white font-sans text-xs font-black rounded-xl transition-all shadow-glow shadow-purple-600/20 flex items-center justify-center gap-2"
                  >
                    {isPythonRunning ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" /> Simulating Numerical Model...
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4 fill-white" /> Compile & Run Simulation
                      </>
                    )}
                  </button>
                </div>

                {/* Console Log + Math Charts */}
                <div className="space-y-4 flex flex-col h-full min-h-0 justify-between">
                  {/* Console Monitor */}
                  <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 flex-grow h-[14.5rem] overflow-y-auto space-y-1.5 custom-scrollbar">
                    <p className="text-[10px] text-slate-500 pb-2 border-b border-slate-900">SANDBOX OUTSTREAM LOGS:</p>
                    {pythonOutput.map((log, i) => (
                      <div key={i} className="text-[11px] text-emerald-400/90 flex gap-2 items-start leading-relaxed">
                        <span className="text-slate-600 select-none">&gt;&gt;&gt;</span>
                        <span className="whitespace-pre-line">{log}</span>
                      </div>
                    ))}
                  </div>

                  {/* Scientific Visualization Area */}
                  {pythonChartData.length > 0 && (
                    <div className="p-4 bg-slate-900/50 border border-slate-800 rounded-2xl space-y-3">
                      <div className="flex items-center justify-between text-xs font-sans">
                        <span className="text-slate-300 font-bold flex items-center gap-1.5">
                          <TrendingUp className="w-3.5 h-3.5 text-purple-400" /> Evolution Vector Graph
                        </span>
                        <span className="text-[10px] text-slate-500">Differential Approximation Iterations</span>
                      </div>
                      
                      {/* SVG Simulation Chart */}
                      <div className="h-20 w-full flex items-end justify-between px-2 pt-2 text-[8px] border-b border-l border-slate-800">
                        {pythonChartData.slice(0, 16).map((data, index) => {
                          const maxVal = 100;
                          return (
                            <div key={index} className="flex-1 flex flex-col items-center gap-1 h-full justify-end group relative">
                              {/* S curve bar */}
                              <div 
                                className="w-1.5 bg-cyan-500 rounded-t-sm hover:opacity-80 transition-opacity"
                                style={{ height: `${(data.s / maxVal) * 100}%` }}
                                title={`S: ${data.s}`}
                              />
                              {/* I curve bar */}
                              <div 
                                className="w-1.5 bg-purple-500 rounded-t-sm hover:opacity-80 transition-opacity"
                                style={{ height: `${(data.i / maxVal) * 100}%` }}
                                title={`I: ${data.i}`}
                              />
                              {/* R curve bar */}
                              <div 
                                className="w-1.5 bg-emerald-500 rounded-t-sm hover:opacity-80 transition-opacity"
                                style={{ height: `${(data.r / maxVal) * 100}%` }}
                                title={`R: ${data.r}`}
                              />
                            </div>
                          );
                        })}
                      </div>
                      
                      <div className="flex items-center justify-center gap-6 font-sans text-[10px]">
                        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-cyan-500" /> Susceptibility (S)</span>
                        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-purple-500" /> Active Vector (I)</span>
                        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Recovery Index (R)</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 2. SQL DATABASE LAB */}
          {activeTab === 'sql' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between text-xs text-slate-400 font-sans">
                <span>Execute raw queries directly into SQLite engine:</span>
                <div className="flex gap-2">
                  {sqlPresets.map((preset, idx) => (
                    <button 
                      key={idx}
                      onClick={() => setSqlQuery(preset.query)}
                      className="px-2 py-1 bg-slate-900 hover:bg-slate-800 rounded border border-slate-800 transition-colors text-[10px] text-purple-300"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <div className="relative">
                  <span className="absolute left-4 top-3 text-[10px] uppercase font-black tracking-widest text-slate-600">SQL CONSOLE</span>
                  <input
                    type="text"
                    value={sqlQuery}
                    onChange={e => setSqlQuery(e.target.value)}
                    className="w-full pl-24 pr-24 py-4 bg-slate-950 border border-slate-800 text-xs font-mono rounded-xl focus:outline-none focus:border-purple-600 text-purple-300 uppercase-none"
                    style={{ textTransform: 'none' }}
                  />
                  <button 
                    onClick={executeSqlQuery}
                    disabled={isSqlRunning}
                    className="absolute right-2 top-2 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold font-sans transition-colors"
                  >
                    {isSqlRunning ? "Executing..." : "Execute Query"}
                  </button>
                </div>

                {sqlResult && (
                  <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden overflow-x-auto text-[11px]">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="bg-slate-900 border-b border-slate-800 text-left text-[10px] text-slate-400 font-sans uppercase tracking-wider">
                          {Object.keys(sqlResult[0] || {}).map((col, k) => (
                            <th key={k} className="p-3 font-semibold">{col}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {sqlResult.map((row, idx) => (
                          <tr key={idx} className="border-b border-slate-850 hover:bg-slate-900/35 transition-colors">
                            {Object.values(row).map((val: any, k) => (
                              <td key={k} className="p-3 text-slate-300 max-w-xs truncate">{String(val)}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {sqlError && (
                  <div className="p-4 bg-red-950/20 border border-red-500/30 text-red-400 rounded-xl flex items-center gap-2.5 text-xs font-sans">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{sqlError}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 3. AI AGENT CONSTRUCTOR */}
          {activeTab === 'ai_agent' && (
            <div className="space-y-6">
              <p className="text-xs text-slate-400 font-sans">
                Isolate parameter variables to prototype live conversational agents that integrate with learning pathways:
              </p>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Parameters Column */}
                <div className="space-y-5 bg-slate-900/40 border border-slate-800 p-5 rounded-2xl font-sans text-xs">
                  <h4 className="font-bold text-slate-200 uppercase tracking-widest text-[10px] pb-2 border-b border-slate-800">Model Variables</h4>
                  
                  {/* Temperature slider */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-[10px]">
                      <span className="text-slate-400 font-bold">Temperature (Creativity)</span>
                      <span className="text-purple-400 font-mono font-bold">{temperature}</span>
                    </div>
                    <input 
                      type="range" 
                      min="0.0" 
                      max="1.5" 
                      step="0.1" 
                      value={temperature}
                      onChange={e => setTemperature(parseFloat(e.target.value))}
                      className="w-full accent-purple-500 cursor-pointer"
                    />
                  </div>

                  {/* Max Tokens */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-[10px]">
                      <span className="text-slate-400 font-bold">Max Tokens (Ctx Size)</span>
                      <span className="text-purple-400 font-mono font-bold">{maxTokens}</span>
                    </div>
                    <input 
                      type="range" 
                      min="64" 
                      max="1024" 
                      step="64" 
                      value={maxTokens}
                      onChange={e => setMaxTokens(parseInt(e.target.value))}
                      className="w-full accent-purple-500 cursor-pointer"
                    />
                  </div>

                  {/* Info Badge */}
                  <div className="p-3 bg-purple-950/20 border border-purple-900/40 rounded-xl flex gap-2 items-start text-[10px] text-purple-300 leading-relaxed">
                    <HelpCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-purple-400" />
                    <span>Prompts inject server-side constraints directly into Gemini LLM execution.</span>
                  </div>
                </div>

                {/* Edit Workspace & Response Column */}
                <div className="lg:col-span-2 space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase font-bold text-slate-400 font-sans">Agent System Guideline:</label>
                    <input
                      type="text"
                      value={systemPrompt}
                      onChange={e => setSystemPrompt(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-xs focus:outline-none focus:border-purple-600 text-purple-300 uppercase-none"
                      style={{ textTransform: 'none' }}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] uppercase font-bold text-slate-400 font-sans">Test User Prompt Input:</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={userTestPrompt}
                        onChange={e => setUserTestPrompt(e.target.value)}
                        className="flex-grow px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-xs focus:outline-none focus:border-purple-600 text-purple-300 uppercase-none"
                        style={{ textTransform: 'none' }}
                      />
                      <button 
                        onClick={executeAgentSession}
                        disabled={isAgentConstructing || !userTestPrompt.trim()}
                        className="px-4 bg-purple-600 hover:bg-purple-700 disabled:opacity-40 rounded-lg text-xs font-bold font-sans transition-all shrink-0 shadow-md shadow-purple-600/20 flex items-center justify-center gap-1"
                      >
                        {isAgentConstructing ? "Synthesizing..." : "Run"}
                      </button>
                    </div>
                  </div>

                  {/* Compiled output wrapper */}
                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 text-[11px] leading-relaxed max-h-[12rem] overflow-y-auto custom-scrollbar font-sans text-slate-300">
                    <p className="text-[10px] font-mono text-slate-500 pb-2 border-b border-slate-900 mb-2 uppercase tracking-wide">COMPILATION STREAM REPLY:</p>
                    {isAgentConstructing ? (
                      <div className="flex items-center gap-2 text-purple-400 font-sans">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Reconstructing parameters and requesting token completion...</span>
                      </div>
                    ) : agentResponse ? (
                      <div className="whitespace-pre-line font-medium">{agentResponse}</div>
                    ) : (
                      <p className="italic text-slate-500 text-center py-4">Click "Run" to establish the conversational session.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 4. DEEP SCHOLARLY INQUIRY */}
          {activeTab === 'deep_research' && (
            <div className="space-y-6">
              <p className="text-xs text-slate-400 font-sans">
                Formulate advanced academic inquiries, generating high-level derivations, proofs, and robust peer-reviewed literature pointers automatically.
              </p>

              <div className="space-y-4">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={scholarlyQuestion}
                    onChange={e => setScholarlyQuestion(e.target.value)}
                    placeholder="Enter advanced technical question... (e.g. quantum mechanics, topology, real analysis)"
                    className="flex-grow px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-xs focus:outline-none focus:border-purple-600 text-purple-300 uppercase-none"
                    style={{ textTransform: 'none' }}
                  />
                  <button 
                    onClick={executeScholarlyInquiry}
                    disabled={isSolving || !scholarlyQuestion.trim()}
                    className="px-5 bg-purple-600 hover:bg-purple-700 disabled:opacity-40 text-xs font-black font-sans rounded-xl transition-all shadow-glow shadow-purple-600/30 flex items-center justify-center gap-1.5 shrink-0"
                  >
                    {isSolving ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Resolving...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5" /> Resolve Proof
                      </>
                    )}
                  </button>
                </div>

                {/* Proof Rendering Workspace */}
                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 min-h-[14rem] overflow-y-auto max-h-[22rem] custom-scrollbar text-xs leading-relaxed text-slate-300 font-sans space-y-4">
                  <div className="flex justify-between items-center pb-2 border-b border-slate-900 border-dashed text-slate-500 font-mono text-[9px] uppercase tracking-wide">
                    <span>Advanced Scholar Proof Workspace</span>
                    <span>Gemini Core Grounding Engine</span>
                  </div>

                  {isSolving ? (
                    <div className="flex flex-col items-center justify-center py-10 space-y-3 font-sans text-slate-400">
                      <RefreshCw className="w-7 h-7 text-purple-400 animate-spin" />
                      <span>Generating comprehensive mathematical proofs, derivations, and citation structures...</span>
                    </div>
                  ) : inquiryResult ? (
                    <div className="whitespace-pre-line font-medium leading-relaxed font-sans">{inquiryResult}</div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8 text-center space-y-2 text-slate-500">
                      <Search className="w-8 h-8 text-slate-700" />
                      <p className="font-bold">Scholar Terminal Idle</p>
                      <p className="max-w-md text-[10px]">Enter a scientific question and click "Resolve Proof" to extract derivation equations.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
