import path from 'node:path';

/**
 * Pure modules (domain, config) may import only relative paths that resolve
 * inside the configured pure roots. Bare, aliased, absolute, query-suffixed
 * and computed specifiers are rejected. Because every pure file obeys the same
 * rule, re-export chains cannot leak platform code into the pure zone.
 */
export default {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Restrict pure modules to relative imports inside the pure zone.',
    },
    schema: [
      {
        type: 'object',
        properties: {
          roots: { type: 'array', items: { type: 'string' }, minItems: 1 },
        },
        required: ['roots'],
        additionalProperties: false,
      },
    ],
    messages: {
      outside:
        'Pure module may import only relative paths inside {{roots}}; got "{{specifier}}".',
      computed: 'Pure module may not use a computed module specifier.',
    },
  },
  create(context) {
    const roots = context.options[0].roots.map((root) => path.resolve(root));
    const directory = path.dirname(context.physicalFilename);
    const rootList = roots
      .map((root) => path.relative(context.cwd, root) || '.')
      .join(', ');

    function check(node, specifier) {
      if (typeof specifier !== 'string') {
        context.report({ node, messageId: 'computed' });
        return;
      }
      const relative =
        specifier.startsWith('./') || specifier.startsWith('../');
      const target = path.resolve(directory, specifier);
      const inside =
        relative &&
        !/[?#]/.test(specifier) &&
        roots.some((root) => target.startsWith(root + path.sep));
      if (!inside) {
        context.report({
          node,
          messageId: 'outside',
          data: { specifier, roots: rootList },
        });
      }
    }

    const literal = (node) =>
      node?.type === 'Literal' && typeof node.value === 'string'
        ? node.value
        : undefined;

    return {
      ImportDeclaration: (node) => check(node.source, node.source.value),
      ExportAllDeclaration: (node) => check(node.source, node.source.value),
      ExportNamedDeclaration(node) {
        if (node.source) check(node.source, node.source.value);
      },
      ImportExpression: (node) => check(node, literal(node.source)),
      TSImportType: (node) => check(node, literal(node.source)),
      TSExternalModuleReference: (node) =>
        check(node, literal(node.expression)),
      'CallExpression[callee.type="Identifier"][callee.name="require"]': (
        node,
      ) => check(node, literal(node.arguments[0])),
    };
  },
};
