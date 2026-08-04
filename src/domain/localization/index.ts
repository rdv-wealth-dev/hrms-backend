import { CountryRegistry } from "./country.registry";
import { IndiaPlugin } from "./IN/index";
import { USAPlugin } from "./US/index";
import { UAEPlugin } from "./AE/index";

export function initializeCountryPlugins(): void {
  CountryRegistry.register(IndiaPlugin);
  CountryRegistry.register(USAPlugin);
  CountryRegistry.register(UAEPlugin);
}
