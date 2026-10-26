import { Project, SyntaxKind } from "ts-morph";
import fs from 'fs';
import path from 'path';

const project = new Project();
project.addSourceFilesAtPaths("src/components/admin/*.tsx");

let modifiedFiles = 0;

for (const sourceFile of project.getSourceFiles()) {
  const filePath = sourceFile.getFilePath();
  if (path.basename(filePath) === 'AdminLayout.tsx') continue;
  
  const text = sourceFile.getFullText();
  if (!text.includes('_az')) continue; // Skip files without any _az reference
  
  let isModified = false;
  
  // 1. Add imports if they don't exist
  const imports = sourceFile.getImportDeclarations();
  const hasLocalizedInput = imports.some(i => i.getModuleSpecifierValue() === './ui/LocalizedInput');
  const hasLocalizedTextarea = imports.some(i => i.getModuleSpecifierValue() === './ui/LocalizedTextarea');
  const hasAdminLocalize = imports.some(i => i.getModuleSpecifierValue() === '@/contexts/AdminLanguageContext');
  
  if (!hasLocalizedInput) {
    sourceFile.addImportDeclaration({
      namedImports: ['LocalizedInput'],
      moduleSpecifier: './ui/LocalizedInput'
    });
    isModified = true;
  }
  
  if (!hasLocalizedTextarea) {
    sourceFile.addImportDeclaration({
      namedImports: ['LocalizedTextarea'],
      moduleSpecifier: './ui/LocalizedTextarea'
    });
    isModified = true;
  }
  
  if (!hasAdminLocalize) {
    sourceFile.addImportDeclaration({
      namedImports: ['useAdminLocalize'],
      moduleSpecifier: '@/contexts/AdminLanguageContext'
    });
    isModified = true;
  }
  
  // 2. Inject `const localize = useAdminLocalize();` into the main component
  const components = sourceFile.getFunctions().filter(f => f.getName()?.startsWith('Admin'));
  const arrowComponents = sourceFile.getVariableDeclarations().filter(v => v.getName()?.startsWith('Admin'));
  
  for (const comp of [...components, ...arrowComponents]) {
    const initializer = comp.getKind() === SyntaxKind.VariableDeclaration ? comp.getInitializerIfKind(SyntaxKind.ArrowFunction) : comp;
    if (initializer) {
      const body = initializer.getBody();
      if (body && body.getKind() === SyntaxKind.Block) {
        if (!body.getFullText().includes('useAdminLocalize(')) {
          body.asKind(SyntaxKind.Block).insertStatements(0, "const localize = useAdminLocalize();");
          isModified = true;
        }
      }
    }
  }

  // 3. Find JSX elements and modify them
  const jsxElements = sourceFile.getDescendantsOfKind(SyntaxKind.JsxSelfClosingElement);
  
  for (const jsx of jsxElements) {
    const tagName = jsx.getTagNameNode().getText();
    if (tagName === 'Input' || tagName === 'Textarea') {
      const valueAttr = jsx.getAttribute('value');
      const onChangeAttr = jsx.getAttribute('onChange');
      
      if (valueAttr && valueAttr.getKind() === SyntaxKind.JsxAttribute) {
        const valueText = valueAttr.getInitializer()?.getText() || '';
        
        // Simple regex to extract `formData.SOMETHING_az` or `form.SOMETHING_az`
        const match = valueText.match(/(\w+)\.(\w+)_az/);
        if (match) {
          const formVarName = match[1]; // formData, form, editForm
          const baseField = match[2]; // title, name, description
          
          // Replace tagName
          const newTagName = tagName === 'Input' ? 'LocalizedInput' : 'LocalizedTextarea';
          
          // Get placeholder to use as label
          const placeholderAttr = jsx.getAttribute('placeholder');
          let labelText = `"${baseField.charAt(0).toUpperCase() + baseField.slice(1)}"`;
          if (placeholderAttr) {
            const pInit = placeholderAttr.getInitializer()?.getText();
            if (pInit) {
              // Try to extract from tr("...", "Real text")
              if (pInit.includes('tr(')) {
                const trMatch = pInit.match(/tr\([^,]+,\s*"([^"]+)"\)/);
                if (trMatch) labelText = `"${trMatch[1].replace(' (AZ)', '').replace(' (EN)', '')}"`;
              } else {
                labelText = pInit.replace(' (AZ)', '').replace(' (EN)', '');
              }
            }
          }

          // Build new element
          let newProps = `formData={${formVarName}} setFormData={set${formVarName.charAt(0).toUpperCase() + formVarName.slice(1)}} field="${baseField}" label=${labelText}`;
          if (tagName === 'Textarea') {
            const rowsAttr = jsx.getAttribute('rows');
            if (rowsAttr) newProps += ` rows=${rowsAttr.getInitializer()?.getText()}`;
          }

          try {
            jsx.replaceWithText(`<${newTagName} ${newProps} />`);
            isModified = true;
          } catch (e) {
            console.error("Failed to replace JSX node", e);
          }
        }
      }
    }
  }

  // 4. Also find and replace inline usages like `item.title_az || item.title` with `localize(item, 'title')`
  const expressions = sourceFile.getDescendantsOfKind(SyntaxKind.BinaryExpression);
  for (const expr of expressions) {
    if (expr.getOperatorToken().getKind() === SyntaxKind.BarBarToken) {
      const left = expr.getLeft().getText();
      const right = expr.getRight().getText();
      const leftMatch = left.match(/(\w+)\.(\w+)_az/);
      const rightMatch = right.match(/(\w+)\.(\w+)/);
      if (leftMatch && rightMatch && leftMatch[1] === rightMatch[1] && leftMatch[2] === rightMatch[2]) {
        try {
            expr.replaceWithText(`localize(${leftMatch[1]}, '${leftMatch[2]}')`);
            isModified = true;
        } catch (e) {
            console.error("Failed to replace binary expr", e);
        }
      }
    }
  }

  if (isModified) {
    sourceFile.saveSync();
    modifiedFiles++;
    console.log(`Refactored ${path.basename(filePath)}`);
  }
}

console.log(`Successfully refactored ${modifiedFiles} files.`);
