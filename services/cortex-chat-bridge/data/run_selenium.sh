#!/bin/bash
echo "Installing Selenium inside container..."
pip install --no-cache-dir selenium
echo "Running autonomous Selenium provisioning script..."
python -u data/selenium_nas_provision.py
