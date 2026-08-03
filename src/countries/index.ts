import { CountryRegistry } from "../core/plugins/country-registry";
import { IndiaPlugin } from "./IN";
import { USAPlugin } from "./US";
import { UAEPlugin } from "./AE";

export function initializeCountryPlugins(): void {
  CountryRegistry.register(IndiaPlugin);
  CountryRegistry.register(USAPlugin);
  CountryRegistry.register(UAEPlugin);
}
