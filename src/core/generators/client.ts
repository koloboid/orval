import { OutputClient } from '../../types';
import {
  GeneratorClientExtra,
  GeneratorImport,
  GeneratorOperations,
  GeneratorOptions,
  GeneratorVerbOptions,
  GeneratorVerbsOptions,
} from '../../types/generator';
import { asyncReduce } from '../../utils/async-reduce';
import { pascal } from '../../utils/case';
import {
  generateAngular,
  generateAngularFooter,
  generateAngularHeader,
  generateAngularTitle,
  getAngularDependencies,
} from './angular';
import {
  generateAxios,
  generateAxiosFooter,
  generateAxiosHeader,
  generateAxiosTitle,
  getAxiosDependencies,
} from './axios';
import { generateDependencyImports } from './imports';
import { generateMSW } from './msw';
import {
  generateReactQuery,
  generateReactQueryFooter,
  generateReactQueryHeader,
  generateReactQueryTitle,
  getReactQueryDependencies,
} from './react-query';
import {
  generateSvelteQuery,
  generateSvelteQueryFooter,
  generateSvelteQueryHeader,
  generateSvelteQueryTitle,
  getSvelteQueryDependencies,
} from './svelte-query';

const DEFAULT_CLIENT = OutputClient.AXIOS;

const GENERATOR_CLIENT = {
  [OutputClient.AXIOS]: {
    client: generateAxios,
    msw: generateMSW,
    header: generateAxiosHeader,
    dependencies: getAxiosDependencies,
    footer: generateAxiosFooter,
    title: generateAxiosTitle,
  },
  [OutputClient.AXIOS_FUNCTIONS]: {
    client: (verbOptions: GeneratorVerbOptions, options: GeneratorOptions) => {
      const { implementation, imports } = generateAxios(verbOptions, options);

      return {
        implementation: 'export ' + implementation,
        imports,
      };
    },
    msw: generateMSW,
    header: (options: {
      title: string;
      isMutator: boolean;
      isRequestOptions: boolean;
    }) => generateAxiosHeader({ ...options, noFunction: true }),
    dependencies: getAxiosDependencies,
    footer: () => '',
    title: generateAxiosTitle,
  },
  [OutputClient.ANGULAR]: {
    client: generateAngular,
    msw: generateMSW,
    header: generateAngularHeader,
    dependencies: getAngularDependencies,
    footer: generateAngularFooter,
    title: generateAngularTitle,
  },
  [OutputClient.REACT_QUERY]: {
    client: generateReactQuery,
    msw: generateMSW,
    header: generateReactQueryHeader,
    dependencies: getReactQueryDependencies,
    footer: generateReactQueryFooter,
    title: generateReactQueryTitle,
  },
  [OutputClient.SVELTE_QUERY]: {
    client: generateSvelteQuery,
    msw: generateMSW,
    header: generateSvelteQueryHeader,
    dependencies: getSvelteQueryDependencies,
    footer: generateSvelteQueryFooter,
    title: generateSvelteQueryTitle,
  },
};
export const generateClientImports = (
  client = DEFAULT_CLIENT,
  implementation: string,
  imports: {
    exports: GeneratorImport[];
    dependency: string;
  }[],
  specsName: Record<string, string>,
): string =>
  generateDependencyImports(
    implementation,
    [...GENERATOR_CLIENT[client].dependencies(), ...imports],
    specsName,
  );

export const generateClientHeader = ({
  outputClient = DEFAULT_CLIENT,
  isRequestOptions,
  title,
  customTitleFunc,
  isGlobalMutator,
  isMutator,
}: {
  outputClient?: OutputClient;
  isRequestOptions: boolean;
  isMutator: boolean;
  isGlobalMutator: boolean;
  title: string;
  customTitleFunc?: (title: string) => string;
}): GeneratorClientExtra => {
  const titles = generateClientTitle(outputClient, title, customTitleFunc);
  return {
    implementation: GENERATOR_CLIENT[outputClient].header({
      title: titles.implementation,
      isRequestOptions,
      isGlobalMutator,
      isMutator,
    }),
    implementationMSW: `export const ${titles.implementationMSW} = () => [\n`,
  };
};

export const generateClientFooter = (
  outputClient: OutputClient = DEFAULT_CLIENT,
  operations: string[],
): GeneratorClientExtra => {
  return {
    implementation: GENERATOR_CLIENT[outputClient].footer(operations),
    implementationMSW: `]\n`,
  };
};

export const generateClientTitle = (
  outputClient: OutputClient = DEFAULT_CLIENT,
  title: string,
  customTitleFunc?: (title: string) => string,
) => {
  if (customTitleFunc) {
    const customTitle = customTitleFunc(title);
    return {
      implementation: GENERATOR_CLIENT[outputClient].title(customTitle),
      implementationMSW: `get${pascal(customTitle)}MSW`,
    };
  }
  return {
    implementation: GENERATOR_CLIENT[outputClient].title(title),
    implementationMSW: `get${pascal(title)}MSW`,
  };
};

export const generateClient = (
  outputClient: OutputClient = DEFAULT_CLIENT,
  verbsOptions: GeneratorVerbsOptions,
  options: GeneratorOptions,
): Promise<GeneratorOperations> => {
  return asyncReduce(
    verbsOptions,
    async (acc, verbOption) => {
      const generator = GENERATOR_CLIENT[outputClient];
      const client = generator.client(verbOption, options);
      const msw = options.mock
        ? await generator.msw(verbOption, options)
        : {
            implementation: {
              function: '',
              handler: '',
            },
            imports: [],
          };

      return {
        ...acc,
        [verbOption.operationId]: {
          implementation: client.implementation,
          imports: client.imports,
          implementationMSW: msw.implementation,
          importsMSW: msw.imports,
          tags: verbOption.tags,
          mutator: verbOption.mutator,
        },
      };
    },
    {} as GeneratorOperations,
  );
};
