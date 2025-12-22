/*!
 * TiLab.js v0.6a
 * MIT License
 * (c) 2025 Daniel Abros
 * Сайт → https://abros.dev
 * <script src="https://cdn.abros.dev/tilab/tilab.js"></script>
 */

(function (window) {
  if (!window.TiLab) {
    const Constants = {
      CDN: "https://cdn.abros.dev",
      CONSOLE_TYPES: ["log", "info", "trace", "warn", "error"],
    };

    function loadScript(src, async = true) {
      return new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = src;
        script.async = async;
        script.onload = () => {
          resolve(src);
        };
        script.onerror = () => {
          reject(new Error(`Не удалось загрузить скрипт: ${src}`));
        };
        document.head.appendChild(script);
      });
    }

    const LibraryModule = () => {
      const storage = [];

      const init = (libName, callback) => {
        const existingLib = storage.find((lib) => lib.name === libName);
        if (existingLib?.isLoaded) {
          if (typeof callback === "function") {
            const exports = existingLib.exports || {};
            callback(...Object.values(exports));
          }
          return Promise.resolve(existingLib.exports);
        }

        const libRecord = {
          name: libName,
          meta: {
            name: "",
            desc: "",
          },
          isLoaded: false,
          isLoading: true,
          timestamp: Date.now(),
          exports: {},
          error: null,
        };
        storage.push(libRecord);
        window.TiLabExport = (libData) => {
          libRecord.meta = {
            name: libData.name,
            desc: libData.desc,
          };
          Object.assign(libRecord.exports, libData.exports);
        };

        return loadScript(`${Constants.CDN}/tilab/libs/${libName}.js`)
          .then(() => {
            delete window.TiLabExport;

            libRecord.isLoaded = true;
            libRecord.isLoading = false;
            libRecord.loadedAt = Date.now();

            if (typeof callback === "function") {
              callback(...Object.values(libRecord.exports));
            }

            return libRecord.exports;
          })
          .catch((error) => {
            delete window.TiLabExport;

            libRecord.isLoaded = false;
            libRecord.isLoading = false;
            libRecord.error = error.message;

            TiLab.console.error(
              "TiLab",
              `Ошибка загрузки библиотеки ${libName}:`,
              error
            );
            throw error;
          });
      };

      const lib = {
        storage,
        init,
      };
      return lib;
    };

    const ConsoleModule = () => {
      const storage = [];

      const addEntry = (type, name, message, data) => {
        const entry = {
          id: Date.now() + Math.random(),
          time: new Date().toLocaleString(),
          type: type || "info",
          name: name || "Система",
          message: message || "",
          data,
        };
        storage.push(entry);
        return entry;
      };

      const console = {
        storage,
        clear: () => {
          storage.length = 0;
        },
      };

      Constants.CONSOLE_TYPES.forEach((type) => {
        console[type] = (name, message, data) =>
          addEntry(type, name, message, data);
      });

      return console;
    };

    const JSXModule = () => {
      const storage = [];

      const jsxWrapper = (callback) => {
        return import(`${Constants.CDN}/tilab/services/preact.module.js`)
          .then((module) => {
            const {
              html,
              render,
              Component,
              h,
              useState,
              useEffect,
              useRef,
              useMemo,
              useCallback,
              useContext,
              createContext,
            } = module;

            if (!html || !render) {
              throw new Error("htm/preact не загружен или функции недоступны");
            }

            window.TiLab.jsx._hooks = {
              useState,
              useEffect,
              useRef,
              useMemo,
              useCallback,
              useContext,
              createContext,
            };

            callback({
              html,
              render,
              Component,
              h,
              useState,
              useEffect,
              useRef,
              useMemo,
              useCallback,
              useContext,
              createContext,
            });

            const componentRecord = {
              id: Date.now() + Math.random(),
              name: callback.name || "Anonymous",
              createdAt: Date.now(),
            };
            storage.push(componentRecord);
          })
          .catch((error) => {
            console.error("Ошибка загрузки Preact:", error);
            throw error;
          });
      };

      const jsx = {
        storage,
        create: jsxWrapper,
      };

      return jsx;
    };

    const QueryModule = () => {
      const queries = new Map();
      const subscribers = new Map();

      const createReactiveData = (windowPath, queryKey) => {
        const pathParts = windowPath.split(".");
        let current = window;

        for (let i = 0; i < pathParts.length - 1; i++) {
          current = current[pathParts[i]];
          if (!current) return null;
        }

        const targetKey = pathParts[pathParts.length - 1];
        const originalData = current[targetKey];

        if (!originalData || typeof originalData !== "object")
          return originalData;

        const reactiveData = {};
        const notify = () => {
          const query = queries.get(queryKey);
          if (query) notifySubscribers(queryKey);
        };

        Object.keys(originalData).forEach((key) => {
          if (typeof originalData[key] === "function") {
            const originalMethod = originalData[key];
            reactiveData[key] = (...args) => {
              const result = originalMethod.apply(originalData, args);
              notify();
              return result;
            };
          } else {
            Object.defineProperty(reactiveData, key, {
              get() {
                return originalData[key];
              },
              set(value) {
                originalData[key] = value;
                notify();
              },
              enumerable: true,
              configurable: true,
            });
          }
        });

        current[targetKey] = reactiveData;
        return reactiveData;
      };

      const createQueryKey = (key) => {
        return typeof key === "string" ? key : JSON.stringify(key);
      };

      const getQuery = (queryKey) => {
        return queries.get(queryKey);
      };

      const setQuery = (queryKey, data) => {
        queries.set(queryKey, {
          data,
          timestamp: Date.now(),
          isLoading: false,
          error: null,
        });
        notifySubscribers(queryKey);
      };

      const setQueryLoading = (queryKey, isLoading = true) => {
        const query = queries.get(queryKey) || {};
        queries.set(queryKey, {
          ...query,
          isLoading,
          timestamp: Date.now(),
        });
        notifySubscribers(queryKey);
      };

      const setQueryError = (queryKey, error) => {
        const query = queries.get(queryKey) || {};
        queries.set(queryKey, {
          ...query,
          error,
          isLoading: false,
          timestamp: Date.now(),
        });
        notifySubscribers(queryKey);
      };

      const notifySubscribers = (queryKey) => {
        const query = queries.get(queryKey);
        const querySubscribers = subscribers.get(queryKey) || [];
        querySubscribers.forEach((callback) => callback(query));
      };

      const subscribe = (queryKey, callback) => {
        if (!subscribers.has(queryKey)) {
          subscribers.set(queryKey, []);
        }
        subscribers.get(queryKey).push(callback);

        const query = queries.get(queryKey);
        if (query) {
          callback(query);
        }

        return () => {
          const querySubscribers = subscribers.get(queryKey) || [];
          const index = querySubscribers.indexOf(callback);
          if (index > -1) {
            querySubscribers.splice(index, 1);
          }
        };
      };

      const invalidateQuery = (queryKey) => {
        queries.delete(queryKey);
        notifySubscribers(queryKey);
      };

      const invalidateQueries = (pattern) => {
        const keysToDelete = [];
        for (const [key] of queries) {
          if (typeof pattern === "string" && key.includes(pattern)) {
            keysToDelete.push(key);
          } else if (pattern instanceof RegExp && pattern.test(key)) {
            keysToDelete.push(key);
          }
        }
        keysToDelete.forEach((key) => {
          queries.delete(key);
          notifySubscribers(key);
        });
      };

      const useQuery = (options) => {
        const { queryKey, queryFn, staleTime = 0, enabled = true } = options;

        const { useState, useEffect } = window.TiLab.jsx._hooks || {};

        if (!useState || !useEffect) {
          console.error(
            "useQuery: хуки недоступны. Используйте внутри TiLab.jsx"
          );
          return { data: undefined, isLoading: false, error: null };
        }

        const queryFnString = queryFn.toString();
        const isGlobalDataQuery = queryFnString.includes("window.");
        const globalPath = isGlobalDataQuery
          ? queryFnString.match(/window\.([\w.]+)/)?.[1]
          : null;

        const [state, setState] = useState({
          data: undefined,
          isLoading: false,
          error: null,
          isSuccess: false,
          isError: false,
          isFetching: false,
        });

        const fullQueryKey = createQueryKey(queryKey);

        useEffect(() => {
          if (!enabled) return;

          const unsubscribe = subscribe(fullQueryKey, (query) => {
            if (query) {
              const isStale = Date.now() - query.timestamp > staleTime;

              setState({
                data: query.data,
                isLoading: query.isLoading,
                error: query.error,
                isSuccess:
                  !query.isLoading && !query.error && query.data !== undefined,
                isError: !!query.error,
                isFetching: query.isLoading,
              });

              if (isStale && !query.isLoading) {
                setQueryLoading(fullQueryKey, true);
                Promise.resolve(queryFn())
                  .then((data) => setQuery(fullQueryKey, data))
                  .catch((error) => setQueryError(fullQueryKey, error));
              }
            } else {
              setQueryLoading(fullQueryKey, true);
              Promise.resolve(queryFn())
                .then((data) => {
                  let finalData = data;
                  if (isGlobalDataQuery && globalPath) {
                    const reactiveData = createReactiveData(
                      `window.${globalPath}`,
                      fullQueryKey
                    );
                    if (reactiveData) finalData = reactiveData;
                  }
                  setQuery(fullQueryKey, finalData);
                })
                .catch((error) => setQueryError(fullQueryKey, error));
            }
          });

          const query = queries.get(fullQueryKey);
          if (!query && !state.isLoading) {
            setQueryLoading(fullQueryKey, true);

            Promise.resolve(queryFn())
              .then((data) => {
                let finalData = data;
                if (isGlobalDataQuery && globalPath) {
                  const reactiveData = createReactiveData(
                    `window.${globalPath}`,
                    fullQueryKey
                  );
                  if (reactiveData) finalData = reactiveData;
                }
                setQuery(fullQueryKey, finalData);
              })
              .catch((error) => setQueryError(fullQueryKey, error));
          }

          return unsubscribe;
        }, [fullQueryKey, enabled, staleTime]);

        return state;
      };

      const useMutation = (options) => {
        const { mutationFn, onSuccess, onError, onSettled } = options;

        const { useState, useCallback } = window.TiLab.jsx._hooks || {};

        if (!useState || !useCallback) {
          console.error(
            "useMutation: хуки недоступны. Используйте внутри TiLab.jsx"
          );
          return { mutate: () => {}, isLoading: false, error: null };
        }

        const [state, setState] = useState({
          data: undefined,
          isLoading: false,
          error: null,
          isSuccess: false,
          isError: false,
        });

        const mutate = useCallback(
          async (variables) => {
            setState((prev) => ({ ...prev, isLoading: true, error: null }));

            try {
              const data = await Promise.resolve(mutationFn(variables));
              setState({
                data,
                isLoading: false,
                error: null,
                isSuccess: true,
                isError: false,
              });

              if (onSuccess) onSuccess(data, variables);
              return data;
            } catch (error) {
              setState({
                data: undefined,
                isLoading: false,
                error,
                isSuccess: false,
                isError: true,
              });

              if (onError) onError(error, variables);
              throw error;
            } finally {
              if (onSettled) onSettled(state.data, error, variables);
            }
          },
          [mutationFn, onSuccess, onError, onSettled]
        );

        const reset = useCallback(() => {
          setState({
            data: undefined,
            isLoading: false,
            error: null,
            isSuccess: false,
            isError: false,
          });
        }, []);

        return { ...state, mutate, reset };
      };

      return {
        useQuery,
        useMutation,
        invalidateQuery,
        invalidateQueries,
      };
    };

    window.TiLab = {
      version: "0.6 (alpha)",
      copyright: "© 2025 Daniel Abros",
      site: "https://abros.dev",
      query: QueryModule(),
      console: ConsoleModule(),
      lib: LibraryModule(),
      jsx: JSXModule().create,
    };

    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("tilab") === "") {
      loadScript(`${Constants.CDN}/tilab/services/panel.js`);
    }
  }
})(window);
