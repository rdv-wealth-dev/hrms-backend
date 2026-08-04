import { CountryRegistry } from "../core/plugins/country-registry";
import { IndiaPlugin } from "./IN";

export function initializeCountryPlugins(): void {
  CountryRegistry.register(IndiaPlugin);
}
