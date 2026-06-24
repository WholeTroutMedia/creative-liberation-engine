import { useState, useEffect } from 'react';

export function useHardwareProfile() {
  const [profile, setProfile] = useState({
    tier: 'core', // core | mid | ultra
    webgpu: false,
    webgl: false,
    gpuName: 'Generic Renderer',
    cores: 4,
    memory: 4,
    compileLatencyMs: 0,
    adapterLimits: null,
    loading: true
  });

  useEffect(() => {
    async function auditHardware() {
      const cores = navigator.hardwareConcurrency || 4;
      const memory = navigator.deviceMemory || 4; // in GB (browser cap)
      let hasWebGPU = false;
      let hasWebGL = false;
      let gpuName = 'Generic Renderer';
      let tier = 'core';
      let adapterLimits = null;
      let compileLatencyMs = 0;

      // 1. WebGL Probe for GPU unmasking
      try {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        if (gl) {
          hasWebGL = true;
          const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
          if (debugInfo) {
            gpuName = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || gpuName;
          }
        }
      } catch (e) {
        console.warn('[hardware-probe] WebGL audit failed:', e);
      }

      // 2. WebGPU Probe & Adapter Limits Check
      try {
        if (navigator.gpu) {
          const adapter = await navigator.gpu.requestAdapter();
          if (adapter) {
            hasWebGPU = true;
            adapterLimits = {};
            // Extract limits of interest
            if (adapter.limits) {
              adapterLimits.maxStorageBufferBindingSize = adapter.limits.maxStorageBufferBindingSize;
              adapterLimits.maxComputeWorkgroupStorageSize = adapter.limits.maxComputeWorkgroupStorageSize;
            }

            // Benchmark WebGPU shader compile latency
            const device = await adapter.requestDevice();
            if (device) {
              const testCode = `@compute @workgroup_size(1) fn main() {}`;
              const start = performance.now();
              const shaderModule = device.createShaderModule({ code: testCode });
              // Trigger compilation check
              const compInfo = await shaderModule.getCompilationInfo();
              compileLatencyMs = Math.round(performance.now() - start);
              device.destroy();
            }
          }
        }
      } catch (e) {
        console.warn('[hardware-probe] WebGPU audit or shader benchmark failed:', e);
      }

      // 3. Dynamic Tier Assignment
      const lowerGpuName = gpuName.toLowerCase();
      const isHighEndGpu = 
        lowerGpuName.includes('nvidia') || 
        lowerGpuName.includes('rtx') || 
        lowerGpuName.includes('amd') || 
        lowerGpuName.includes('radeon') ||
        lowerGpuName.includes('apple m') || // M1/M2/M3/M4 Apple Silicon
        lowerGpuName.includes('geforce');

      const isMidEndGpu = 
        lowerGpuName.includes('intel') || 
        lowerGpuName.includes('iris') || 
        lowerGpuName.includes('apple gpu') || 
        lowerGpuName.includes('qualcomm') || 
        lowerGpuName.includes('adreno');

      if (hasWebGPU && (isHighEndGpu || (cores >= 8 && memory >= 8))) {
        tier = 'ultra';
      } else if (hasWebGPU || (hasWebGL && (isMidEndGpu || cores >= 4))) {
        tier = 'mid';
      } else {
        tier = 'core';
      }

      setProfile({
        tier,
        webgpu: hasWebGPU,
        webgl: hasWebGL,
        gpuName,
        cores,
        memory,
        compileLatencyMs,
        adapterLimits,
        loading: false
      });
    }

    auditHardware();
  }, []);

  return profile;
}

export default useHardwareProfile;
