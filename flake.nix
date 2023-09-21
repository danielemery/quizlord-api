{
  description = "Quizlord API Development Environment";

  inputs = { nixpkgs.url = "github:nixos/nixpkgs/nixos-unstable"; };

  outputs = { self, nixpkgs }:
    let
      inherit (nixpkgs.lib) genAttrs;
      supportedSystems = [
        "aarch64-darwin"
        "x86_64-darwin"
        "x86_64-linux"
      ];
      forAllSystems = f: genAttrs supportedSystems (system: f system);
    in
    {
      devShells = forAllSystems (system:
        let pkgs = import nixpkgs { inherit system; };
        in {
          default = pkgs.mkShell {
            nativeBuildInputs = [ pkgs.bashInteractive ];
            buildInputs = with pkgs; [
              doppler
              nodejs-18_x

              # See https://github.com/prisma/prisma/issues/3026#issuecomment-927258138 for all the details about running Prisma
              nodePackages.prisma
              openssl
            ];
            shellHook = with pkgs; ''
              export PRISMA_SCHEMA_ENGINE_BINARY="${prisma-engines}/bin/schema-engine";
              export PRISMA_QUERY_ENGINE_BINARY="${prisma-engines}/bin/query-engine";
              export PRISMA_QUERY_ENGINE_LIBRARY="${prisma-engines}/lib/libquery_engine.node";
              export PRISMA_FMT_BINARY="${prisma-engines}/bin/prisma-fmt";
            '';
          };
        });
    };
}
