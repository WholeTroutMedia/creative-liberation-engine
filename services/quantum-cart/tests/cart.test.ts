import { describe, it, expect } from "vitest";
import { QuantumCartStore } from "../src/quantum-store.js";
import { CommerceRecommendationEngine } from "../src/recommendation-engine.js";

describe("Quantum Cart Commerce Suite", () => {
  it("should securely track user cart additions and calculate hash values", () => {
    const userId = "user-100";
    QuantumCartStore.clearCart(userId);

    QuantumCartStore.addItem(userId, {
      id: "item-88",
      name: "Smart Sensors",
      price: 25.00,
      quantity: 2,
      category: "electronics"
    });

    const cart = QuantumCartStore.getCart(userId);
    expect(cart.items.length).toBe(1);
    expect(QuantumCartStore.getTotalAmount(userId)).toBe(50.00);

    const firstHash = QuantumCartStore.calculateCartHash(userId);
    expect(firstHash).toBeDefined();

    // Add another item and ensure hash updates change uniquely
    QuantumCartStore.addItem(userId, {
      id: "item-99",
      name: "Tactical Cable",
      price: 10.00,
      quantity: 1,
      category: "electronics"
    });

    const secondHash = QuantumCartStore.calculateCartHash(userId);
    expect(secondHash).not.toBe(firstHash);
    expect(QuantumCartStore.getTotalAmount(userId)).toBe(60.00);
  });

  it("should calculate predictive values-aligned suggestions", () => {
    const cartItems = [
      {
        id: "item-88",
        name: "Smart Sensors",
        price: 25.00,
        quantity: 2,
        category: "electronics"
      }
    ];

    const recommendations = CommerceRecommendationEngine.getSuggestions(cartItems);
    expect(recommendations.length).toBeGreaterThan(0);
    
    // Ensure the catalog items returned are matching category or are highly sustainable
    const matched = recommendations.some(rec => rec.category === "electronics" || rec.sustainabilityScore >= 9);
    expect(matched).toBe(true);
  });
});
