import { beforeEach, describe, expect, it } from "vitest";
import { emptyProfile, loadLocalProfile, saveLocalProfile } from "../lib/profile";

describe("Persistência Local do Perfil", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("salva e recupera o perfil localmente mesmo com servidor offline", () => {
    const userProfile = {
      name: "Gabriel Silva",
      email: "ggnonato@gmail.com",
      phone: "11987654321",
      birthDate: "2000-01-01",
      address: "Brasília, DF",
    };

    saveLocalProfile(userProfile);
    const loaded = loadLocalProfile("ggnonato@gmail.com");

    expect(loaded).not.toBeNull();
    expect(loaded?.name).toBe("Gabriel Silva");
    expect(loaded?.email).toBe("ggnonato@gmail.com");
    expect(loaded?.phone).toBe("11987654321");
    expect(loaded?.address).toBe("Brasília, DF");
  });

  it("retorna null se não houver perfil salvo para o e-mail", () => {
    const loaded = loadLocalProfile("inexistente@gmail.com");
    expect(loaded).toBeNull();
  });
});
