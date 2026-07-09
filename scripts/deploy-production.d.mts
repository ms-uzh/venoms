export type CommandRunner = (
  command: string,
  args: string[],
  options: { cwd: string; stdio: "inherit" },
) => unknown;

export function deployProduction(run?: CommandRunner): void;
