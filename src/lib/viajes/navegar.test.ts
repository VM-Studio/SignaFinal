import { describe, expect, it } from "vitest";
import { urlAndroid, urlIOS, urlWeb } from "./navegar";

const ps = [{ lat: -34.5875, lng: -58.4575 }, { lat: -34.5843, lng: -58.4437 }, { lat: -34.5925, lng: -58.4376 }];

describe("abrir en Google Maps", () => {
  it("web: la última es el destino y las anteriores, paradas intermedias en orden", () => {
    const u = new URL(urlWeb(ps));
    expect(u.searchParams.get("destination")).toBe("-34.5925,-58.4376");
    expect(u.searchParams.get("waypoints")).toBe("-34.5875,-58.4575|-34.5843,-58.4437");
    expect(u.searchParams.get("travelmode")).toBe("driving");
  });
  it("iPhone: comgooglemaps con los destinos encadenados", () => {
    expect(urlIOS(ps)).toBe("comgooglemaps://?daddr=-34.5875,-58.4575+to:-34.5843,-58.4437+to:-34.5925,-58.4376&directionsmode=driving");
  });
  it("Android: intent a la app de Google Maps con la web de respaldo", () => {
    const u = urlAndroid(ps);
    expect(u.startsWith("intent://www.google.com/maps/dir/?")).toBe(true);
    expect(u).toContain("package=com.google.android.apps.maps");
    expect(u).toContain("S.browser_fallback_url=https%3A%2F%2Fwww.google.com");
  });
});
