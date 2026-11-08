.PHONY: help test check demo clean install

PYTHON ?= python3

help:
	@echo "Creative Liberation Engine (cle) — Unix Makefile Targets:"
	@echo "  make test      Run the standard-library unit test suite"
	@echo "  make check     Run environment doctor and syntax verification"
	@echo "  make demo      Execute the example Unix stdin/stdout pipeline"
	@echo "  make clean     Remove temporary cache and bytecode files"

test:
	PYTHONPATH=src $(PYTHON) -m unittest discover -s tests -v

check:
	./bin/cle doctor
	PYTHONPATH=src $(PYTHON) -m py_compile src/cle/*.py tests/*.py

demo:
	sh ./examples/unix_pipeline.sh

clean:
	find . -name "__pycache__" -type d -prune -exec rm -rf {} +
	find . -name "*.pyc" -delete
