import os
import json
import requests
import time
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

class ShopifySync:
    def __init__(self, memory_service_url: str = None):
        self.shop_url = os.getenv("SHOPIFY_SHOP_URL", "nhkfcf-pf.myshopify.com")
        self.access_token = os.getenv("SHOPIFY_ADMIN_ACCESS_TOKEN")
        self.api_version = "2024-04"
        self.headers = {
            "Content-Type": "application/json",
            "X-Shopify-Access-Token": self.access_token
        }
        self.memory_service_url = memory_service_url or os.getenv("MEMORY_SERVICE_URL", "http://localhost:5070")

    def _graphql_query(self, query: str, variables: dict = None) -> dict:
        url = f"https://{self.shop_url}/admin/api/{self.api_version}/graphql.json"
        payload = {"query": query}
        if variables:
            payload["variables"] = variables
            
        try:
            response = requests.post(url, json=payload, headers=self.headers)
            response.raise_for_status()
            return response.json()
        except Exception as e:
            print(f"[SHOPIFY ERROR] GraphQL request failed: {e}")
            return {}

    def get_latest_drop_from_memory(self) -> dict:
        url = f"{self.memory_service_url}/api/documents/latent_space_current_drop/active"
        try:
            res = requests.get(url, timeout=5)
            if res.status_code == 200:
                data = res.json()
                latest = data.get("activeState", {}).get("latest")
                if latest:
                    return latest
        except Exception as e:
            print(f"[WARNING] Failed to load latest drop from memory: {e}")
        return {}

    def upload_local_image(self, file_path_str: str) -> str:
        """
        Uploads a local image file directly to Shopify using stagedUploadsCreate.
        Returns the staged resourceUrl ready to be attached as product media.
        """
        file_path = Path(file_path_str)
        if not file_path.exists():
            print(f"[SHOPIFY ERROR] Local image not found: {file_path_str}")
            return ""

        filename = file_path.name
        file_size = file_path.stat().st_size
        mime_type = "image/jpeg" if file_path.suffix.lower() in [".jpg", ".jpeg"] else "image/webp"

        print(f"[SHOPIFY] Requesting GCS staged upload target for {filename} ({file_size} bytes)...")
        staged_mutation = """
        mutation stagedUploadsCreate($input: [StagedUploadInput!]!) {
          stagedUploadsCreate(input: $input) {
            stagedTargets {
              url
              resourceUrl
              parameters {
                name
                value
              }
            }
            userErrors {
              field
              message
            }
          }
        }
        """
        
        variables = {
            "input": [
                {
                    "fileSize": str(file_size),
                    "mimeType": mime_type,
                    "filename": filename,
                    "resource": "PRODUCT_IMAGE"
                }
            ]
        }
        
        res = self._graphql_query(staged_mutation, variables)
        errors = res.get("data", {}).get("stagedUploadsCreate", {}).get("userErrors", [])
        if errors:
            print(f"[SHOPIFY ERROR] Staged upload target request failed: {errors}")
            return ""
            
        targets = res.get("data", {}).get("stagedUploadsCreate", {}).get("stagedTargets", [])
        if not targets:
            print("[SHOPIFY ERROR] No staged targets returned.")
            return ""
            
        target = targets[0]
        upload_url = target["url"]
        resource_url = target["resourceUrl"]

        print(f"[SHOPIFY] Performing raw PUT upload to GCS for {filename}...")
        with open(file_path, "rb") as f:
            file_data = f.read()

        # Execute raw PUT request matching GCS signed algorithm requirements
        upload_res = requests.put(upload_url, headers={"Content-Type": mime_type}, data=file_data)
        if upload_res.status_code in [200, 201]:
            print(f"[SHOPIFY SUCCESS] GCS Staged Upload completed. Resource: {resource_url}")
            return resource_url
        else:
            print(f"[SHOPIFY ERROR] GCS PUT upload failed ({upload_res.status_code}): {upload_res.text}")
            return ""

    def create_merch_product(self, drop_data: dict, local_image_path: str = None) -> dict:
        """
        Creates a custom multi-option Shopify product representing the photography asset.
        Generates 11 distinct variants across Prints, Streetwear Tees, and Sovereign Hoodies.
        Optionally uploads the local high-res WebP image directly to Shopify CDN and attaches it.
        Returns a dictionary containing product_id, variants map, and direct public CDN image_url.
        """
        if not self.access_token:
            print("[SHOPIFY] Dry Run (Token not configured). Simulating product creation.")
            return {
                "product_id": "gid://shopify/Product/DRYRUN_12345",
                "image_url": "https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?q=80&w=2070&auto=format&fit=crop",
                "variants": {
                    "print_24x36": "43074801041456",
                    "tee_S": "43074801074224",
                    "tee_M": "43074801074225",
                    "tee_L": "43074801074226",
                    "tee_XL": "43074801074227",
                    "tee_XXL": "43074801074228",
                    "hoodie_S": "43074801074229",
                    "hoodie_M": "43074801074230",
                    "hoodie_L": "43074801074231",
                    "hoodie_XL": "43074801074232",
                    "hoodie_XXL": "43074801074233"
                }
            }

        print(f"[SHOPIFY] 1. Provisioning product options container: {drop_data['title']}")
        
        # Step 1: Create the product structure with options definition
        create_query = """
        mutation productCreate($input: ProductInput!) {
          productCreate(input: $input) {
            product {
              id
              title
              variants(first: 1) {
                edges {
                  node {
                    id
                  }
                }
              }
            }
            userErrors {
              field
              message
            }
          }
        }
        """

        create_variables = {
          "input": {
            "title": f"Latent Space Drop: {drop_data['title']}",
            "descriptionHtml": f"<strong>Latent Space Studios — Limited Streetwear & Fine Art Drop</strong><br/>"
                               f"High-end archival release operated dynamically by Creative Liberation Collective.<br/>"
                               f"Camera: {drop_data['metadata'].get('camera')}<br/>"
                               f"Exposure: {drop_data['metadata'].get('exposure')}<br/>"
                               f"ISO: {drop_data['metadata'].get('iso')}",
            "vendor": "Latent Space Studios",
            "productType": "Apparel",
            "status": "ACTIVE",
            "tags": ["Latent Space Drop", "Archival"],
            "productOptions": [
              {
                "name": "Style",
                "values": [
                  { "name": "Archival Matte Frame" },
                  { "name": "Heavyweight Streetwear Tee" },
                  { "name": "Sovereign Fleece Hoodie" }
                ]
              },
              {
                "name": "Size",
                "values": [
                  { "name": "24x36" },
                  { "name": "S" },
                  { "name": "M" },
                  { "name": "L" },
                  { "name": "XL" },
                  { "name": "XXL" }
                ]
              }
            ]
          }
        }
        
        res = self._graphql_query(create_query, create_variables)
        errors = res.get("data", {}).get("productCreate", {}).get("userErrors", [])
        if errors:
            print(f"[SHOPIFY ERROR] Product create failed: {errors}")
            return {}
            
        product_node = res.get("data", {}).get("productCreate", {}).get("product", {})
        product_id = product_node.get("id", "")
        default_edges = product_node.get("variants", {}).get("edges", [])
        if not default_edges:
            print("[SHOPIFY ERROR] No default variant was created.")
            return {}
            
        default_variant_id = default_edges[0]["node"]["id"]
        print(f"[SHOPIFY] Created product container ID: {product_id}")
        print(f"[SHOPIFY] Default variant ID: {default_variant_id}")

        # Step 2: Update the default variant price to $120.00
        print("[SHOPIFY] 2. Updating default print variant price...")
        update_query = """
        mutation productVariantsBulkUpdate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
          productVariantsBulkUpdate(productId: $productId, variants: $variants) {
            userErrors {
              field
              message
            }
          }
        }
        """
        update_variables = {
            "productId": product_id,
            "variants": [
                {
                    "id": default_variant_id,
                    "price": "120.00"
                }
            ]
        }
        res_update = self._graphql_query(update_query, update_variables)
        update_errors = res_update.get("data", {}).get("productVariantsBulkUpdate", {}).get("userErrors", [])
        if update_errors:
            print(f"[SHOPIFY WARNING] Default variant update returned errors: {update_errors}")

        # Step 3: Bulk create the remaining 10 clothing variants
        print("[SHOPIFY] 3. Bulk creating remaining 10 variants...")
        bulk_query = """
        mutation productVariantsBulkCreate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
          productVariantsBulkCreate(productId: $productId, variants: $variants) {
            userErrors {
              field
              message
            }
          }
        }
        """
        
        variants_input = []
        # Tees (S-XXL)
        for size in ["S", "M", "L", "XL", "XXL"]:
            variants_input.append({
                "optionValues": [
                    { "optionName": "Style", "name": "Heavyweight Streetwear Tee" },
                    { "optionName": "Size", "name": size }
                ],
                "price": "38.00"
            })
        # Hoodies (S-XXL)
        for size in ["S", "M", "L", "XL", "XXL"]:
            variants_input.append({
                "optionValues": [
                    { "optionName": "Style", "name": "Sovereign Fleece Hoodie" },
                    { "optionName": "Size", "name": size }
                ],
                "price": "75.00"
            })

        bulk_variables = {
            "productId": product_id,
            "variants": variants_input
        }
        res_bulk = self._graphql_query(bulk_query, bulk_variables)
        bulk_errors = res_bulk.get("data", {}).get("productVariantsBulkCreate", {}).get("userErrors", [])
        if bulk_errors:
            print(f"[SHOPIFY WARNING] Bulk variants creation returned errors: {bulk_errors}")

        # Step 4: Upload and attach the local high-res WebP image directly to Shopify CDN!
        cdn_url = ""
        if local_image_path:
            print(f"[SHOPIFY] 4. Executing direct staged upload pipeline for {local_image_path}...")
            staged_resource_url = self.upload_local_image(local_image_path)
            if staged_resource_url:
                print("[SHOPIFY] Attaching staged media resource to product...")
                media_mutation = """
                mutation productCreateMedia($productId: ID!, $media: [CreateMediaInput!]!) {
                  productCreateMedia(productId: $productId, media: $media) {
                    media {
                      id
                      status
                    }
                    userErrors {
                      field
                      message
                    }
                  }
                }
                """
                media_vars = {
                    "productId": product_id,
                    "media": [
                        {
                            "mediaContentType": "IMAGE",
                            "originalSource": staged_resource_url
                        }
                    ]
                }
                res_media = self._graphql_query(media_mutation, media_vars)
                media_errors = res_media.get("data", {}).get("productCreateMedia", {}).get("userErrors", [])
                if media_errors:
                    print(f"[SHOPIFY WARNING] Failed to attach media: {media_errors}")
                else:
                    print("[SHOPIFY] Media attached. Polling GCS to fetch permanent Shopify CDN URL...")
                    # Poll for READY state
                    query_media = """
                    query getProductMedia($id: ID!) {
                      product(id: $id) {
                        media(first: 5) {
                          edges {
                            node {
                              id
                              status
                              ... on MediaImage {
                                image {
                                  url
                                }
                              }
                            }
                          }
                        }
                      }
                    }
                    """
                    for attempt in range(8):
                        time.sleep(1.5)
                        res_query = self._graphql_query(query_media, {"id": product_id})
                        media_nodes = res_query.get("data", {}).get("product", {}).get("media", {}).get("edges", [])
                        if media_nodes:
                            node = media_nodes[0]["node"]
                            status = node.get("status")
                            if status == "READY":
                                cdn_url = node.get("image", {}).get("url")
                                print(f"[SHOPIFY SUCCESS] Image processed successfully! CDN URL: {cdn_url}")
                                break
                            elif status == "FAILED":
                                print("[SHOPIFY WARNING] Image media processing failed in Shopify.")
                                break
                                
        # Fallback to high-res placeholder if upload failed or was skipped
        if not cdn_url:
            cdn_url = "https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?q=80&w=2070&auto=format&fit=crop"

        # Step 5: Query the final product option grid variants list and construct mapping
        print("[SHOPIFY] 5. Fetching final product variants list...")
        query_variants = """
        query getVariants($id: ID!) {
          product(id: $id) {
            variants(first: 30) {
              edges {
                node {
                  id
                  selectedOptions {
                    name
                    value
                  }
                }
              }
            }
          }
        }
        """
        res_query = self._graphql_query(query_variants, {"id": product_id})
        variants_edges = res_query.get("data", {}).get("product", {}).get("variants", {}).get("edges", [])
        
        variants_map = {}
        for edge in variants_edges:
            node = edge["node"]
            v_id = node["id"]
            numeric_v_id = v_id.split("/")[-1]
            
            opts = node.get("selectedOptions", [])
            style_val = ""
            size_val = ""
            for opt in opts:
                if opt["name"] == "Style":
                    style_val = opt["value"]
                elif opt["name"] == "Size":
                    size_val = opt["value"]
            
            key = ""
            if style_val == "Archival Matte Frame":
                key = "print_24x36"
            elif style_val == "Heavyweight Streetwear Tee":
                key = f"tee_{size_val}"
            elif style_val == "Sovereign Fleece Hoodie":
                key = f"hoodie_{size_val}"
                
            if key:
                variants_map[key] = numeric_v_id
                
        print(f"[SHOPIFY SUCCESS] Product created: {product_id} with {len(variants_map)} verified live variants.")
        return {
            "product_id": product_id,
            "variants": variants_map,
            "image_url": cdn_url
        }

    def delete_expired_drops(self):
        if not self.access_token:
            print("[SHOPIFY] Dry Run. Skipping expired drops cleanup.")
            return

        print("[SHOPIFY] Scanning for expired drops to archive...")
        query = """
        {
          products(first: 50, query: "tag:'Latent Space Drop'") {
            edges {
              node {
                id
                title
                createdAt
              }
            }
          }
        }
        """
        res = self._graphql_query(query)
        edges = res.get("data", {}).get("products", {}).get("edges", [])
        
        for edge in edges:
            node = edge["node"]
            print(f"[SHOPIFY] Archiving expired drop: {node['title']} ({node['id']})")
            
            archive_query = """
            mutation productUpdate($input: ProductInput!) {
              productUpdate(input: $input) {
                product {
                  id
                  status
                }
              }
            }
            """
            archive_vars = {
              "input": {
                "id": node["id"],
                "status": "ARCHIVED"
              }
            }
            self._graphql_query(archive_query, archive_vars)

    def sync_latest(self) -> dict:
        drop = self.get_latest_drop_from_memory()
        if not drop:
            print("[SHOPIFY] No active drop in memory spine. Run curation first.")
            return {}
        return self.create_merch_product(drop, local_image_path=drop.get("local_path"))

if __name__ == "__main__":
    sync = ShopifySync()
    res = sync.sync_latest()
    print("[SHOPIFY SYNC RESULT]", res)
