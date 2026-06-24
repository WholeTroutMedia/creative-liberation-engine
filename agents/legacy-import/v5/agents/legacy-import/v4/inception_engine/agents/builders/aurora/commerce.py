#!/usr/bin/env python3
"""
COMMERCE Agent - Agentic Commerce Optimization (ACO)

Builds ecommerce applications optimized for Google's Universal Commerce Protocol (UCP)
and AI agent-driven purchasing.

Capabilities:
- Complete Schema.org Product markup generation
- Google Merchant Center feed creation
- Conversational commerce attributes
- Return policy configuration
- Multi-modal optimization
- Cart/Checkout API generation
- UCP six capabilities coverage
"""

import json
import logging
from typing import Dict, List, Optional
from pathlib import Path

logger = logging.getLogger(__name__)


class CommerceAgent:
    """
    COMMERCE agent for building ACO-optimized ecommerce applications.
    Part of AURORA hive.
    """

    def __init__(self):
        self.name = "COMMERCE"
        self.hive = "AURORA"
        self.specialization = "ecommerce"
        self.context_library = self._load_commerce_patterns()

        self.activate()
    def _load_commerce_patterns(self) -> str:
        """Load commerce patterns from context library."""
        try:
            patterns_path = Path("CORE_FOUNDATION/context-library/commerce-patterns.md")
            if patterns_path.exists():
                return patterns_path.read_text()
            else:
                logger.warning("commerce-patterns.md not found, using minimal context")
                return "Ecommerce best practices loaded"
        except Exception as e:
            logger.error(f"Failed to load commerce patterns: {e}")
            return ""

    def generate_product_schema(self, product: Dict) -> Dict:
        """
        Generate complete Schema.org Product markup.

        Args:
            product: Product data dict with required fields

        Returns:
            Complete Schema.org JSON-LD object
        """
        schema = {
            "@context": "https://schema.org",
            "@type": "Product",
            "name": product.get("name", ""),
            "description": product.get("description", ""),
            "sku": product.get("sku", ""),
            "brand": {
                "@type": "Brand",
                "name": product.get("brand", "")
            },
            "image": product.get("images", []),
            "offers": {
                "@type": "Offer",
                "price": str(product.get("price", 0)),
                "priceCurrency": product.get("currency", "USD"),
                "availability": f"https://schema.org/{product.get('availability', 'InStock')}",
                "url": product.get("url", ""),
                "seller": {
                    "@type": "Organization",
                    "name": product.get("seller_name", "")
                }
            }
        }

        # Add GTIN if available
        if product.get("gtin"):
            schema["gtin"] = product["gtin"]

        # Add shipping details
        if product.get("shipping"):
            schema["offers"]["shippingDetails"] = self._generate_shipping_details(
                product["shipping"]
            )

        # Add ratings if available
        if product.get("rating"):
            schema["aggregateRating"] = {
                "@type": "AggregateRating",
                "ratingValue": str(product["rating"]),
                "reviewCount": str(product.get("review_count", 0))
            }

        # Add reviews if available
        if product.get("reviews"):
            schema["review"] = [
                self._generate_review_schema(review)
                for review in product["reviews"][:5]  # Top 5 reviews
            ]

        # Add variants if available
        if product.get("variants"):
            schema["hasVariant"] = [
                self._generate_variant_schema(variant, product)
                for variant in product["variants"]
            ]

        return schema

    def _generate_shipping_details(self, shipping: Dict) -> Dict:
        """Generate Schema.org shippingDetails."""
        return {
            "@type": "OfferShippingDetails",
            "shippingRate": {
                "@type": "MonetaryAmount",
                "value": str(shipping.get("cost", 0)),
                "currency": shipping.get("currency", "USD")
            },
            "deliveryTime": {
                "@type": "ShippingDeliveryTime",
                "handlingTime": {
                    "@type": "QuantitativeValue",
                    "minValue": shipping.get("handling_min", 1),
                    "maxValue": shipping.get("handling_max", 2),
                    "unitCode": "DAY"
                },
                "transitTime": {
                    "@type": "QuantitativeValue",
                    "minValue": shipping.get("transit_min", 3),
                    "maxValue": shipping.get("transit_max", 5),
                    "unitCode": "DAY"
                }
            }
        }

    def _generate_review_schema(self, review: Dict) -> Dict:
        """Generate Schema.org Review."""
        return {
            "@type": "Review",
            "author": {
                "@type": "Person",
                "name": review.get("author", "Anonymous")
            },
            "datePublished": review.get("date", ""),
            "reviewRating": {
                "@type": "Rating",
                "ratingValue": str(review.get("rating", 5))
            },
            "reviewBody": review.get("body", "")
        }

    def _generate_variant_schema(self, variant: Dict, parent_product: Dict) -> Dict:
        """Generate product variant schema."""
        return {
            "@type": "Product",
            "name": f"{parent_product['name']} - {variant.get('name', '')}",
            "sku": variant.get("sku", ""),
            "gtin": variant.get("gtin", ""),
            "color": variant.get("color"),
            "size": variant.get("size"),
            "offers": {
                "@type": "Offer",
                "price": str(variant.get("price", parent_product.get("price", 0))),
                "priceCurrency": parent_product.get("currency", "USD"),
                "availability": f"https://schema.org/{variant.get('availability', 'InStock')}"
            }
        }

    def generate_merchant_center_item(self, product: Dict) -> str:
        """
        Generate Google Merchant Center feed item XML.

        Args:
            product: Product data dict

        Returns:
            XML string for Merchant Center feed
        """
        xml_parts = []
        xml_parts.append("<item>")
        xml_parts.append(f"  <g:id>{product.get('sku', '')}</g:id>")
        xml_parts.append(f"  <g:title>{self._escape_xml(product.get('name', ''))}</g:title>")
        xml_parts.append(f"  <g:description>{self._escape_xml(product.get('description', ''))}</g:description>")
        xml_parts.append(f"  <g:link>{product.get('url', '')}</g:link>")
        
        if product.get("images"):
            xml_parts.append(f"  <g:image_link>{product['images'][0]}</g:image_link>")
        
        xml_parts.append(f"  <g:price>{product.get('price', 0)} {product.get('currency', 'USD')}</g:price>")
        xml_parts.append(f"  <g:availability>{product.get('availability', 'in stock').lower()}</g:availability>")
        xml_parts.append(f"  <g:brand>{self._escape_xml(product.get('brand', ''))}</g:brand>")
        
        if product.get("gtin"):
            xml_parts.append(f"  <g:gtin>{product['gtin']}</g:gtin>")
        
        # ACO-specific attributes
        xml_parts.append("  <g:native_commerce>true</g:native_commerce>")
        xml_parts.append("  <g:return_policy_label>30-day-returns</g:return_policy_label>")
        
        # Conversational attributes
        if product.get("attributes"):
            for attr in product["attributes"]:
                xml_parts.append("  <g:product_detail>")
                xml_parts.append(f"    <g:attribute_name>{self._escape_xml(attr['name'])}</g:attribute_name>")
                xml_parts.append(f"    <g:attribute_value>{self._escape_xml(attr['value'])}</g:attribute_value>")
                xml_parts.append("  </g:product_detail>")
        
        xml_parts.append("</item>")
        return "\n".join(xml_parts)

    def _escape_xml(self, text: str) -> str:
        """Escape XML special characters."""
        if not text:
            return ""
        return (
            text.replace("&", "&amp;")
            .replace("<", "&lt;")
            .replace(">", "&gt;")
            .replace('"', "&quot;")
            .replace("'", "&apos;")
        )

    def generate_return_policy_schema(self, policy: Dict) -> Dict:
        """
        Generate return policy schema.

        Args:
            policy: Return policy configuration

        Returns:
            Schema.org MerchantReturnPolicy object
        """
        return {
            "@context": "https://schema.org",
            "@type": "MerchantReturnPolicy",
            "applicableCountry": policy.get("country", "US"),
            "returnPolicyCategory": "https://schema.org/MerchantReturnFiniteReturnWindow",
            "merchantReturnDays": policy.get("window_days", 30),
            "returnMethod": "https://schema.org/ReturnByMail",
            "returnFees": policy.get("fees", "https://schema.org/FreeReturn"),
            "returnPolicyUrl": policy.get("url", "")
        }

    def generate_organization_schema(self, org: Dict) -> Dict:
        """
        Generate organization schema for Merchant of Record.

        Args:
            org: Organization data

        Returns:
            Schema.org Organization object
        """
        schema = {
            "@context": "https://schema.org",
            "@type": "Organization",
            "name": org.get("name", ""),
            "url": org.get("url", ""),
            "logo": org.get("logo", ""),
            "description": org.get("description", "")
        }

        # Add address if available
        if org.get("address"):
            schema["address"] = {
                "@type": "PostalAddress",
                "streetAddress": org["address"].get("street", ""),
                "addressLocality": org["address"].get("city", ""),
                "addressRegion": org["address"].get("state", ""),
                "postalCode": org["address"].get("zip", ""),
                "addressCountry": org["address"].get("country", "US")
            }

        # Add contact point
        if org.get("contact"):
            schema["contactPoint"] = {
                "@type": "ContactPoint",
                "contactType": "Customer Service",
                "telephone": org["contact"].get("phone", ""),
                "email": org["contact"].get("email", ""),
                "availableLanguage": ["English"]
            }

        # Add social media links
        if org.get("social"):
            schema["sameAs"] = org["social"]

        return schema

    def generate_react_product_component(self, component_name: str = "ProductPage") -> str:
        """
        Generate React component with Schema.org markup.

        Returns:
            TypeScript React component code
        """
        return '''import React from 'react'
import { Helmet } from 'react-helmet'
from cle_engine.core.agent_executor import AgentResult, AgentCapability

interface Product {
  name: string
  sku: string
  gtin: string
  brand: string
  description: string
  price: number
  currency: string
  images: string[]
  availability: 'InStock' | 'OutOfStock'
  rating: number
  reviewCount: number
  url: string
  sellerName: string
}

export function ProductPage({ product }: { product: Product }) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    sku: product.sku,
    gtin: product.gtin,
    brand: { '@type': 'Brand', name: product.brand },
    description: product.description,
    image: product.images,
    offers: {
      '@type': 'Offer',
      price: product.price.toFixed(2),
      priceCurrency: product.currency,
      availability: `https://schema.org/${product.availability}`,
      url: product.url,
      seller: { '@type': 'Organization', name: product.sellerName }
    },
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: product.rating.toFixed(1),
      reviewCount: product.reviewCount
    }
  }

  return (
    <>
      <Helmet>
        <script type="application/ld+json">
          {JSON.stringify(schema)}
        </script>
      </Helmet>
      
      <article itemScope itemType="https://schema.org/Product">
        <h1 itemProp="name">{product.name}</h1>
        <div className="product-images">
          {product.images.map((img, i) => (
            <img key={i} src={img} alt={product.name} itemProp="image" />
          ))}
        </div>
        <p itemProp="description">{product.description}</p>
        <div itemProp="offers" itemScope itemType="https://schema.org/Offer">
          <meta itemProp="priceCurrency" content={product.currency} />
          <meta itemProp="price" content={product.price.toString()} />
          <span className="price">${product.price}</span>
          <link itemProp="availability" href={`https://schema.org/${product.availability}`} />
          {product.availability === 'InStock' ? (
            <button className="add-to-cart">Add to Cart</button>
          ) : (
            <span className="out-of-stock">Out of Stock</span>
          )}
        </div>
        <div className="rating">
          {product.rating} stars ({product.reviewCount} reviews)
        </div>
      </article>
    </>
  )
}
'''

    def validate_aco_compliance(self, product: Dict) -> Dict:
        """
        Validate product data for ACO compliance.

        Returns:
            Validation report with issues and warnings
        """
        issues = []
        warnings = []

        # Required fields
        required = ["name", "sku", "brand", "price", "currency", "images"]
        for field in required:
            if not product.get(field):
                issues.append(f"Missing required field: {field}")

        # GTIN recommended
        if not product.get("gtin"):
            warnings.append("Missing GTIN - reduces discoverability")

        # Shipping details
        if not product.get("shipping"):
            warnings.append("Missing shipping details - agents can't estimate delivery")

        # Reviews
        if not product.get("rating") or not product.get("review_count"):
            warnings.append("Missing ratings/reviews - reduces trust")

        # Multiple images
        if product.get("images") and len(product["images"]) < 3:
            warnings.append("Less than 3 images - multi-modal optimization needs multiple angles")

        # Conversational attributes
        if not product.get("attributes"):
            warnings.append("Missing conversational attributes - limits fan-out query matching")

        return {
            "compliant": len(issues) == 0,
            "issues": issues,
            "warnings": warnings,
            "score": max(0, 100 - (len(issues) * 20) - (len(warnings) * 5))
        }


if __name__ == "__main__":
    # Test COMMERCE agent
    agent = CommerceAgent()

    test_product = {
        "name": "Premium Running Shoe",
        "sku": "SHOE-001",
        "gtin": "00012345678905",
        "brand": "RunFast",
        "description": "High-performance running shoe with maximum cushioning",
        "price": 129.99,
        "currency": "USD",
        "images": [
            "https://example.com/shoe-front.jpg",
            "https://example.com/shoe-side.jpg",
            "https://example.com/shoe-detail.jpg"
        ],
        "availability": "InStock",
        "rating": 4.7,
        "review_count": 342,
        "url": "https://example.com/products/shoe-001",
        "seller_name": "RunFast Store",
        "shipping": {
            "cost": 5.99,
            "handling_min": 1,
            "handling_max": 2,
            "transit_min": 3,
            "transit_max": 5
        },
        "attributes": [
            {"name": "Material", "value": "Breathable mesh upper, EVA foam midsole"},
            {"name": "Best For", "value": "Long-distance road running"},
            {"name": "Cushioning Level", "value": "Maximum cushioning"}
        ]
    }

    print("=" * 70)
    print("COMMERCE AGENT TEST")
    print("=" * 70)

    # Generate product schema
    schema = agent.generate_product_schema(test_product)
    print("\nProduct Schema:")
    print(json.dumps(schema, indent=2))

    # Validate compliance
    validation = agent.validate_aco_compliance(test_product)
    print("\nACO Compliance:")
    print(json.dumps(validation, indent=2))

    # Generate Merchant Center item
    print("\nMerchant Center XML:")
    print(agent.generate_merchant_center_item(test_product))
