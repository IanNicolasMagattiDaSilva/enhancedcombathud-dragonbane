import "../styles/module.scss";

import { registerSettings, registerSkillSettings } from "./settings";
import { setupDragonbaneHud } from "./dragonbaneui";
import { registerRoundResetHook } from "./dragonbane-action-tracker";

Hooks.once("init", () => {
  registerSettings();
  registerRoundResetHook();
  console.log("Argon HUD - Dragonbane: init complete");
});

Hooks.once("ready", () => {
  registerSkillSettings();
  console.log("Argon HUD - Dragonbane: skill settings complete");
});

Hooks.on("argonInit", (CoreHUD) => {
  setupDragonbaneHud(CoreHUD);
  console.log("Argon HUD - Dragonbane: UI setup complete");
});
