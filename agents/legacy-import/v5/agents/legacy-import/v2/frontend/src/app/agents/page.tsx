'use client';

import React from 'react';

export default function AgentsPage() {
  return (
    <div className="container mx-auto px-4 pb-20">
      <div className="glass rounded-2xl p-8 animate-fade-in">
        <h1 className="text-4xl font-bold text-white mb-6">
          AI Agents
        </h1>
        <p className="text-gray-300 mb-8">
          Meet the intelligent agents powering your creative workflows. Our AI orchestration layer coordinates multiple specialized agents to deliver exceptional results across all creative domains.
        </p>
        
        {/* Agent Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-12">
          {/* Visual Art Agents */}
          <div className="glass rounded-xl p-6 border-2 border-purple-500/30">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-purple-400">🎨 Visual Art Agents</h3>
              <div className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-sm font-bold">Active</div>
            </div>
            <p className="text-gray-400 mb-4 text-sm">Specialized in image generation, character design, and visual concept development</p>
            <div className="space-y-3">
              <div className="glass rounded-lg p-3">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-bold text-sm">Concept Agent</span>
                  <span className="text-xs text-green-400">• Online</span>
                </div>
                <p className="text-xs text-gray-500">DALL-E 3, Midjourney, Stable Diffusion</p>
              </div>
              <div className="glass rounded-lg p-3">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-bold text-sm">Character Agent</span>
                  <span className="text-xs text-green-400">• Online</span>
                </div>
                <p className="text-xs text-gray-500">Character design & iteration</p>
              </div>
              <div className="glass rounded-lg p-3">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-bold text-sm">Style Agent</span>
                  <span className="text-xs text-green-400">• Online</span>
                </div>
                <p className="text-xs text-gray-500">Style transfer & consistency</p>
              </div>
            </div>
          </div>
          
          {/* Narrative Agents */}
          <div className="glass rounded-xl p-6 border-2 border-cyan-500/30">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-cyan-400">🎬 Narrative Agents</h3>
              <div className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-sm font-bold">Active</div>
            </div>
            <p className="text-gray-400 mb-4 text-sm">Expert video generation, editing, and storytelling coordination</p>
            <div className="space-y-3">
              <div className="glass rounded-lg p-3">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-bold text-sm">Video Agent</span>
                  <span className="text-xs text-green-400">• Online</span>
                </div>
                <p className="text-xs text-gray-500">Runway, Pika, Stable Video</p>
              </div>
              <div className="glass rounded-lg p-3">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-bold text-sm">Story Agent</span>
                  <span className="text-xs text-green-400">• Online</span>
                </div>
                <p className="text-xs text-gray-500">Narrative structure & pacing</p>
              </div>
              <div className="glass rounded-lg p-3">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-bold text-sm">Edit Agent</span>
                  <span className="text-xs text-green-400">• Online</span>
                </div>
                <p className="text-xs text-gray-500">Scene composition & transitions</p>
              </div>
            </div>
          </div>
          
          {/* Audio Agents */}
          <div className="glass rounded-xl p-6 border-2 border-emerald-500/30">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-emerald-400">🎵 Audio Agents</h3>
              <div className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-sm font-bold">Active</div>
            </div>
            <p className="text-gray-400 mb-4 text-sm">Musical composition, sound design, and audio processing specialists</p>
            <div className="space-y-3">
              <div className="glass rounded-lg p-3">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-bold text-sm">Music Agent</span>
                  <span className="text-xs text-green-400">• Online</span>
                </div>
                <p className="text-xs text-gray-500">Suno, Udio, MusicGen</p>
              </div>
              <div className="glass rounded-lg p-3">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-bold text-sm">Voice Agent</span>
                  <span className="text-xs text-green-400">• Online</span>
                </div>
                <p className="text-xs text-gray-500">Voice synthesis & dialogue</p>
              </div>
              <div className="glass rounded-lg p-3">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-bold text-sm">Sound Agent</span>
                  <span className="text-xs text-green-400">• Online</span>
                </div>
                <p className="text-xs text-gray-500">Effects & ambient design</p>
              </div>
            </div>
          </div>
          
          {/* Orchestration Agent */}
          <div className="glass rounded-xl p-6 border-2 border-yellow-500/30">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-yellow-400">🧠 Orchestration</h3>
              <div className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-sm font-bold">Active</div>
            </div>
            <p className="text-gray-400 mb-4 text-sm">Master coordinator ensuring seamless collaboration across all agents</p>
            <div className="space-y-2 text-sm text-gray-400">
              <div className="flex items-center space-x-2">
                <span>✅</span>
                <span>Task routing & prioritization</span>
              </div>
              <div className="flex items-center space-x-2">
                <span>✅</span>
                <span>Quality control & validation</span>
              </div>
              <div className="flex items-center space-x-2">
                <span>✅</span>
                <span>Resource optimization</span>
              </div>
              <div className="flex items-center space-x-2">
                <span>✅</span>
                <span>Error recovery & retry logic</span>
              </div>
            </div>
          </div>
          
          {/* Quality Agent */}
          <div className="glass rounded-xl p-6 border-2 border-blue-500/30">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-blue-400">🔍 Quality Control</h3>
              <div className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-sm font-bold">Active</div>
            </div>
            <p className="text-gray-400 mb-4 text-sm">Ensures output meets quality standards and creative vision</p>
            <div className="space-y-2 text-sm text-gray-400">
              <div className="flex items-center space-x-2">
                <span>✅</span>
                <span>Automated quality checks</span>
              </div>
              <div className="flex items-center space-x-2">
                <span>✅</span>
                <span>Consistency validation</span>
              </div>
              <div className="flex items-center space-x-2">
                <span>✅</span>
                <span>Performance monitoring</span>
              </div>
              <div className="flex items-center space-x-2">
                <span>✅</span>
                <span>Output refinement</span>
              </div>
            </div>
          </div>
          
          {/* Analytics Agent */}
          <div className="glass rounded-xl p-6 border-2 border-pink-500/30">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-pink-400">📊 Analytics</h3>
              <div className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-sm font-bold">Active</div>
            </div>
            <p className="text-gray-400 mb-4 text-sm">Tracks metrics, insights, and performance across all operations</p>
            <div className="space-y-2 text-sm text-gray-400">
              <div className="flex items-center space-x-2">
                <span>✅</span>
                <span>Real-time metrics tracking</span>
              </div>
              <div className="flex items-center space-x-2">
                <span>✅</span>
                <span>Performance analytics</span>
              </div>
              <div className="flex items-center space-x-2">
                <span>✅</span>
                <span>Usage pattern analysis</span>
              </div>
              <div className="flex items-center space-x-2">
                <span>✅</span>
                <span>Optimization recommendations</span>
              </div>
            </div>
          </div>
        </div>
        
        {/* Agent Benefits */}
        <div className="mt-12 glass rounded-xl p-8">
          <h2 className="text-2xl font-bold mb-6">Why Agent-Based Architecture?</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <div className="text-4xl mb-3">⚡</div>
              <h4 className="font-bold mb-2">Lightning Fast</h4>
              <p className="text-gray-400 text-sm">Parallel processing across multiple agents means faster results. What takes hours manually happens in minutes.</p>
            </div>
            <div>
              <div className="text-4xl mb-3">🎯</div>
              <h4 className="font-bold mb-2">Specialized Expertise</h4>
              <p className="text-gray-400 text-sm">Each agent is optimized for specific tasks, ensuring the best possible output for every aspect of your project.</p>
            </div>
            <div>
              <div className="text-4xl mb-3">🔄</div>
              <h4 className="font-bold mb-2">Intelligent Coordination</h4>
              <p className="text-gray-400 text-sm">Agents communicate and collaborate automatically, maintaining consistency and quality across all creative outputs.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}