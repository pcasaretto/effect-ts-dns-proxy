{ pkgs, lib, config, inputs, ... }:

{
  # https://devenv.sh/languages/
  languages.javascript.enable = true;
  languages.javascript.npm.enable = true;
}
