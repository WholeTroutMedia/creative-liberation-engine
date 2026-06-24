"""CodeAgent implementation for code generation tasks.

This agent specializes in generating, modifying, and implementing
code based on task specifications and context.
"""

from typing import Any, Dict, List, Optional
import logging

from orchestration.core.agent_base import AgentBase, AgentConfig
from orchestration.core.artifact_manager import ArtifactManager
from orchestration.core.git_coordinator import GitCoordinator

logger = logging.getLogger(__name__)


class CodeAgent(AgentBase):
    """Agent specialized in code generation and implementation.
    
    The CodeAgent handles tasks related to:
    - Generating new code files from specifications
    - Modifying existing code based on requirements
    - Implementing features and bug fixes
    - Refactoring and code improvements
    
    Attributes:
        supported_languages: List of programming languages supported
        templates: Code templates for common patterns
    """
    
    SUPPORTED_LANGUAGES = [
        "python", "javascript", "typescript", "java",
        "go", "rust", "c", "cpp", "ruby", "php"
    ]
    
    def __init__(
        self,
        config: AgentConfig,
        git_coordinator: Optional[GitCoordinator] = None,
        artifact_manager: Optional[ArtifactManager] = None,
    ):
        """Initialize the CodeAgent.
        
        Args:
            config: Agent configuration
            git_coordinator: Git operations coordinator
            artifact_manager: Artifact storage manager
        """
        super().__init__(config)
        self.git_coordinator = git_coordinator
        self.artifact_manager = artifact_manager
        self._templates: Dict[str, str] = {}
        self._context_files: List[str] = []
        
    async def execute(self, task: Dict[str, Any]) -> Dict[str, Any]:
        """Execute a code generation task.
        
        Args:
            task: Task specification containing:
                - action: Type of code action (generate, modify, refactor)
                - language: Target programming language
                - specification: Detailed requirements
                - context: Additional context files or information
                
        Returns:
            Dict containing:
                - status: Success/failure status
                - files: List of generated/modified files
                - output: Generated code or modifications
                - metadata: Additional execution metadata
        """
        action = task.get("action", "generate")
        language = task.get("language", "python")
        specification = task.get("specification", "")
        context = task.get("context", {})
        
        logger.info(f"CodeAgent executing {action} for {language}")
        
        if language.lower() not in self.SUPPORTED_LANGUAGES:
            return {
                "status": "error",
                "error": f"Unsupported language: {language}",
                "supported": self.SUPPORTED_LANGUAGES,
            }
        
        try:
            if action == "generate":
                result = await self._generate_code(language, specification, context)
            elif action == "modify":
                result = await self._modify_code(language, specification, context)
            elif action == "refactor":
                result = await self._refactor_code(language, specification, context)
            else:
                result = {
                    "status": "error",
                    "error": f"Unknown action: {action}",
                }
                
            # Store artifacts if manager available
            if self.artifact_manager and result.get("status") == "success":
                for file_info in result.get("files", []):
                    await self.artifact_manager.store(
                        artifact_type="code",
                        content=file_info.get("content", ""),
                        metadata={
                            "filename": file_info.get("filename"),
                            "language": language,
                            "action": action,
                        }
                    )
                    
            return result
            
        except Exception as e:
            logger.error(f"CodeAgent execution failed: {e}")
            return {
                "status": "error",
                "error": str(e),
            }
    
    async def _generate_code(
        self,
        language: str,
        specification: str,
        context: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Generate new code from specification.
        
        Args:
            language: Target programming language
            specification: Code requirements and specifications
            context: Additional context information
            
        Returns:
            Generation result with files and metadata
        """
        # Prepare generation context
        gen_context = {
            "language": language,
            "specification": specification,
            "templates": self._templates.get(language, ""),
            "context_files": context.get("files", []),
        }
        
        # In production, this would call an LLM or code generation service
        # For now, return a structured placeholder
        generated_code = self._create_placeholder_code(language, specification)
        
        return {
            "status": "success",
            "files": [{
                "filename": context.get("target_file", f"generated.{self._get_extension(language)}"),
                "content": generated_code,
                "language": language,
            }],
            "metadata": {
                "action": "generate",
                "language": language,
                "context": gen_context,
            }
        }
    
    async def _modify_code(
        self,
        language: str,
        specification: str,
        context: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Modify existing code based on specification.
        
        Args:
            language: Target programming language
            specification: Modification requirements
            context: Context including source file content
            
        Returns:
            Modification result with updated files
        """
        source_file = context.get("source_file", "")
        source_content = context.get("source_content", "")
        
        if not source_content:
            return {
                "status": "error",
                "error": "No source content provided for modification",
            }
        
        # In production, this would analyze and modify the code
        modified_content = f"# Modified based on: {specification}\n{source_content}"
        
        return {
            "status": "success",
            "files": [{
                "filename": source_file or f"modified.{self._get_extension(language)}",
                "content": modified_content,
                "language": language,
                "original": source_content,
            }],
            "metadata": {
                "action": "modify",
                "language": language,
            }
        }
    
    async def _refactor_code(
        self,
        language: str,
        specification: str,
        context: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Refactor code for improved quality.
        
        Args:
            language: Target programming language
            specification: Refactoring goals
            context: Context including source files
            
        Returns:
            Refactoring result with updated files
        """
        source_files = context.get("files", [])
        
        if not source_files:
            return {
                "status": "error",
                "error": "No source files provided for refactoring",
            }
        
        refactored_files = []
        for file_info in source_files:
            refactored_content = f"# Refactored: {specification}\n{file_info.get('content', '')}"
            refactored_files.append({
                "filename": file_info.get("filename", "refactored.py"),
                "content": refactored_content,
                "language": language,
            })
        
        return {
            "status": "success",
            "files": refactored_files,
            "metadata": {
                "action": "refactor",
                "language": language,
                "files_processed": len(refactored_files),
            }
        }
    
    def _create_placeholder_code(self, language: str, specification: str) -> str:
        """Create placeholder code structure.
        
        Args:
            language: Target programming language
            specification: Code specification
            
        Returns:
            Placeholder code string
        """
        templates = {
            "python": '''"""Generated module.

{spec}
"""


def main():
    """Main entry point."""
    pass


if __name__ == "__main__":
    main()
''',
            "javascript": '''/**
 * Generated module.
 * {spec}
 */

function main() {{
    // Implementation
}}

module.exports = {{ main }};
''',
            "typescript": '''/**
 * Generated module.
 * {spec}
 */

export function main(): void {{
    // Implementation
}}
''',
        }
        
        template = templates.get(language, templates["python"])
        return template.format(spec=specification[:100] if specification else "Auto-generated")
    
    def _get_extension(self, language: str) -> str:
        """Get file extension for language.
        
        Args:
            language: Programming language name
            
        Returns:
            File extension string
        """
        extensions = {
            "python": "py",
            "javascript": "js",
            "typescript": "ts",
            "java": "java",
            "go": "go",
            "rust": "rs",
            "c": "c",
            "cpp": "cpp",
            "ruby": "rb",
            "php": "php",
        }
        return extensions.get(language.lower(), "txt")
    
    def add_template(self, language: str, template: str) -> None:
        """Add a code template for a language.
        
        Args:
            language: Programming language
            template: Template string
        """
        self._templates[language.lower()] = template
    
    def set_context_files(self, files: List[str]) -> None:
        """Set context files for code generation.
        
        Args:
            files: List of file paths to use as context
        """
        self._context_files = files
