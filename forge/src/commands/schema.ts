import type { Command } from 'commander';
import { zodToJsonSchema } from 'zod-to-json-schema';
import {
  MonitorForgeConfigSchema,
  SourceSchema,
  LayerSchema,
  PanelSchema,
  ViewSchema,
  AISchema,
  MapSchema,
  BackendSchema,
  BuildSchema,
  MonitorSchema,
  ThemeSchema,
} from '../config/schema.js';
import { formatOutput, success, structuredFailure, type OutputFormat } from '../output/format.js';

const sectionSchemas: Record<string, import('zod').ZodTypeAny> = {
  monitor: MonitorSchema,
  sources: SourceSchema,
  layers: LayerSchema,
  panels: PanelSchema,
  views: ViewSchema,
  ai: AISchema,
  map: MapSchema,
  backend: BackendSchema,
  build: BuildSchema,
  theme: ThemeSchema,
};

export function registerSchemaCommand(program: Command): void {
  program
    .command('schema [section]')
    .description('Output JSON Schema for the config (optionally filtered by section)')
    .action((section?: string) => {
      const format = (program.opts().format ?? 'table') as OutputFormat;

      try {
        if (section) {
          const schema = sectionSchemas[section];
          if (!schema) {
            const validSections = Object.keys(sectionSchemas).join(', ');
            console.log(formatOutput(
              structuredFailure('schema', `Unknown section "${section}". Valid sections: ${validSections}`),
              format,
            ));
            process.exit(1);
          }
          const jsonSchema = zodToJsonSchema(schema, { name: section, target: 'jsonSchema7' });
          (jsonSchema as Record<string, unknown>)._note =
            'Zod .refine() validators are not represented in JSON Schema output';
          console.log(formatOutput(success('schema', jsonSchema), format));
          return;
        }

        const jsonSchema = zodToJsonSchema(MonitorForgeConfigSchema, {
          name: 'MonitorForgeConfig',
          target: 'jsonSchema7',
        });
        (jsonSchema as Record<string, unknown>)._note =
          'Zod .refine() validators are not represented in JSON Schema output';
        console.log(formatOutput(success('schema', jsonSchema), format));
      } catch (err) {
        console.log(formatOutput(
          structuredFailure('schema', err instanceof Error ? err : String(err)),
          format,
        ));
        process.exit(1);
      }
    });
}
