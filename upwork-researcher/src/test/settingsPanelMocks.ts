/**
 * Shared mock factory for SettingsPanel tests.
 * Provides baseline invoke mocks that every SettingsPanel test needs,
 * with per-test overrides for section-specific commands.
 *
 * Usage:
 *   mockInvoke.mockImplementation(createSettingsMockInvoke());
 *   mockInvoke.mockImplementation(createSettingsMockInvoke({ get_voice_profile: () => Promise.resolve(null) }));
 */

type InvokeHandler = (args?: any) => Promise<unknown>;
type InvokeOverrides = Record<string, InvokeHandler>;

const baselineHandlers: Record<string, InvokeHandler> = {
  get_safety_threshold: () => Promise.resolve(180),
  get_user_rate_config: () =>
    Promise.resolve({ hourly_rate: null, project_rate_min: null }),
  get_user_skills: () => Promise.resolve([]),
  get_setting: () => Promise.resolve(null),
  get_voice_profile: () => Promise.resolve(null),
  get_proposals_edited_count: () => Promise.resolve(0),
  set_setting: () => Promise.resolve(),
  set_log_level: () => Promise.resolve(),
};

/**
 * Creates a mock invoke implementation with baseline SettingsPanel handlers.
 * Override any command by passing a handler map.
 */
export function createSettingsMockInvoke(
  overrides: InvokeOverrides = {}
): (command: string, args?: any) => Promise<unknown> {
  const handlers = { ...baselineHandlers, ...overrides };

  return (command: string, args?: any) => {
    const handler = handlers[command];
    if (handler) {
      return handler(args);
    }
    return Promise.reject(
      new Error(
        `[settingsPanelMocks] Unmocked command: "${command}". Add it to baselineHandlers or pass an override.`
      )
    );
  };
}
