import * as crypto from "crypto";

export interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  category: string;
}

export interface UserCart {
  userId: string;
  items: CartItem[];
  updatedAt: number;
}

export class QuantumCartStore {
  private static carts: Map<string, UserCart> = new Map();

  /**
   * Initialize or retrieve an existing user cart
   */
  public static getCart(userId: string): UserCart {
    if (!this.carts.has(userId)) {
      this.carts.set(userId, {
        userId,
        items: [],
        updatedAt: Date.now()
      });
    }
    return this.carts.get(userId)!;
  }

  /**
   * Add or update an item in a user's cart
   */
  public static addItem(userId: string, item: CartItem): UserCart {
    const cart = this.getCart(userId);
    const existingIndex = cart.items.findIndex(i => i.id === item.id);

    if (existingIndex > -1) {
      cart.items[existingIndex].quantity += item.quantity;
    } else {
      cart.items.push(item);
    }

    cart.updatedAt = Date.now();
    this.carts.set(userId, cart);
    return cart;
  }

  /**
   * Clear a user's cart
   */
  public static clearCart(userId: string): void {
    this.carts.delete(userId);
  }

  /**
   * Compute a secure cart hash for AP2 payment mandates
   */
  public static calculateCartHash(userId: string): string {
    const cart = this.getCart(userId);
    const serialized = cart.items
      .map(item => `${item.id}:${item.price}:${item.quantity}`)
      .sort()
      .join("|");

    return crypto.createHash("sha256").update(serialized).digest("hex");
  }

  /**
   * Get target total amount
   */
  public static getTotalAmount(userId: string): number {
    const cart = this.getCart(userId);
    return cart.items.reduce((total, item) => total + item.price * item.quantity, 0);
  }
}
