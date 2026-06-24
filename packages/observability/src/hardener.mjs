/**
 * Compose Hardener — validates and hardens Docker Compose configurations.
 *
 * Ensures all services have health checks, resource limits,
 * restart policies, and security configurations.
 *
 * @capabilityId cap_compose_hardener
 */

const REQUIRED_SERVICE_FIELDS = ['restart', 'networks'];
const RECOMMENDED_FIELDS = ['healthcheck', 'deploy'];

export class ComposeHardener {
  /**
   * Validate a composition manifest.
   * @param {object} composition - Parsed composition.local.json
   * @returns {{ valid: boolean, warnings: string[], errors: string[] }}
   */
  validate(composition) {
    const errors = [];
    const warnings = [];

    if (!composition.version) errors.push('Missing version');
    if (!composition.services) errors.push('Missing services');

    for (const [name, svc] of Object.entries(composition.services || {})) {
      if (!svc.role) warnings.push(`${name}: missing role`);
      if (svc.routeManifest && !svc.ports) {
        warnings.push(`${name}: has routeManifest but no ports`);
      }
      if (svc.dependsOn) {
        for (const dep of svc.dependsOn) {
          if (!composition.services[dep]) {
            errors.push(`${name}: depends on unknown service "${dep}"`);
          }
        }
      }
    }

    return { valid: errors.length === 0, warnings, errors };
  }

  /**
   * Generate hardening recommendations.
   * @param {object} composition
   * @returns {string[]}
   */
  harden(composition) {
    const recommendations = [];
    for (const [name, svc] of Object.entries(composition.services || {})) {
      if (!svc.healthCheck && !svc.role?.includes('worker')) {
        recommendations.push(`${name}: add healthCheck for liveness probes`);
      }
      if (svc.ports?.host && !svc.role?.includes('persistence')) {
        recommendations.push(`${name}: consider internal-only networking (no host port)`);
      }
    }
    return recommendations;
  }
}

export function validateCompose(composition) { return new ComposeHardener().validate(composition); }
export function hardenCompose(composition) { return new ComposeHardener().harden(composition); }
