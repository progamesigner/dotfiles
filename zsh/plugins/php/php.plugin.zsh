#! /bin/zsh

# Aliases
# =======
alias php-server="noglob php -S localhost:3333 index.php"
alias get-composer="curl -s https://getcomposer.org/installer | php"

# Auto completions
# ================
compdef _composer composer.phar
