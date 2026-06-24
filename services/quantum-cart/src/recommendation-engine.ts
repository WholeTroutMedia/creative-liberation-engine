import { CartItem } from "./quantum-store.js";

export interface Recommendation {
  id: string;
  name: string;
  price: number;
  category: string;
  sustainabilityScore: number; // Scale 1 to 10
  rationale: string;
}

export class CommerceRecommendationEngine {
  private static catalog: Recommendation[] = [
    {
      id: "rec-001",
      name: "Sovereign Organic Coffee Beans",
      price: 18.50,
      category: "groceries",
      sustainabilityScore: 9,
      rationale: "Locally roasted, direct-trade organic beans matching your shopping history."
    },
    {
      id: "rec-002",
      name: "Biodegradable Laptop Sleeve",
      price: 34.00,
      category: "electronics",
      sustainabilityScore: 10,
      rationale: "Constructed from 100% recycled marine fibers."
    },
    {
      id: "rec-003",
      name: "Recycled Bamboo Notebook",
      price: 8.99,
      category: "books",
      sustainabilityScore: 8,
      rationale: "Zero forest footprint notebook matching your research directives."
    }
  ];

  /**
   * Proactively suggest items matching current cart categories and sustainability goals
   */
  public static getSuggestions(cartItems: CartItem[]): Recommendation[] {
    const currentCategories = new Set(cartItems.map(item => item.category));

    return this.catalog.filter(rec => {
      // Suggest if matching a category currently in the cart
      if (currentCategories.has(rec.category)) {
        return true;
      }
      // Or suggest general high-scoring sustainable alternatives
      return rec.sustainabilityScore >= 9;
    });
  }
}
