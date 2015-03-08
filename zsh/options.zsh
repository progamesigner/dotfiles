#! /bin/zsh

# General
# =======
setopt BEEP                 # Beep on error in line editor.
setopt BRACE_CCL            # Allow brace character class list expansion.
setopt COMBINING_CHARS      # Combine zero-length punctuation characters (accents)
                            # with the base character.
setopt INTERACTIVECOMMENTS  # Turn on interactive comments; comments begin with a #.
setopt LOCAL_OPTIONS        # Allow functions to have local options.
setopt LOCAL_TRAPS          # Allow functions to have local traps.
setopt RC_QUOTES            # Allow 'Henry''s Garage' instead of 'Henry'\''s Garage'.
setopt NO_MAIL_WARNING      # Don't print a warning message if a mail file has been accessed.
setopt NO_NOMATCH           # Don't die when a glob expansion matches no files
autoload -Uz add-zsh-hook   # Don't override precmd/preexec; append to hook array.

# Smart URLs
# ==========
autoload -Uz url-quote-magic
zle -N self-insert url-quote-magic

# Jobs
# ====
setopt LONG_LIST_JOBS # List jobs in the long format by default.
setopt AUTO_RESUME    # Attempt to resume existing job before creating a new process.
setopt NOTIFY         # Report status of background jobs immediately.
setopt NO_BG_NICE     # Don't run all background jobs at a lower priority.
setopt NO_HUP         # Don't kill jobs on shell exit.
setopt NO_CHECK_JOBS  # Don't report on jobs when shell exit.

# History
# =======
if [ -z "${HISTFILE}" ]; then
    HISTFILE="${HOME}/.zsh_history"
fi

HISTSIZE=10000
SAVEHIST=10000

case ${HIST_STAMPS} in
  "mm/dd/yyyy") alias history="fc -fl 1" ;;
  "dd.mm.yyyy") alias history="fc -El 1" ;;
  "yyyy-mm-dd") alias history="fc -il 1" ;;
  *) alias history="fc -l 1" ;;
esac

setopt APPEND_HISTORY           # Add history
setopt BANG_HIST                # Treat the "!" character specially during expansion
setopt EXTENDED_HISTORY         # Write the history file in the ":start:elapsed;command" format
setopt HIST_BEEP                # Beep when accessing non-existent history
setopt HIST_EXPIRE_DUPS_FIRST   # Expire a duplicate event first when trimming history
setopt HIST_FIND_NO_DUPS        # Do not display a previously found event
setopt HIST_IGNORE_DUPS         # Do not record an event that was just recorded again
setopt HIST_IGNORE_ALL_DUPS     # Delete an old recorded event if a new event is a duplicate
setopt HIST_IGNORE_SPACE        # Do not record an event starting with a space
setopt HIST_SAVE_NO_DUPS        # Do not write a duplicate event to the history file
setopt HIST_VERIFY              # Do not execute immediately upon history expansion
setopt INC_APPEND_HISTORY       # Write to the history file immediately, not when the shell exits
setopt HIST_REDUCE_BLANKS       # Remove superfluous blanks from each command line being added to the history list
setopt SHARE_HISTORY            # Share history between all sessions

# Directory
# =========
setopt AUTO_CD              # Auto changes to a directory without typing cd
setopt AUTO_PUSHD           # Push the old directory onto the stack on cd
setopt PUSHD_IGNORE_DUPS    # Do not store duplicates in the stack
setopt PUSHD_SILENT         # Do not print the directory stack after pushd or popd
setopt PUSHD_MINUS
setopt PUSHD_TO_HOME        # Push to home directory when no argument is given
setopt CDABLE_VARS          # Change directory to a path stored in a variable
setopt AUTO_NAME_DIRS       # Auto add variable-stored paths to ~ list
setopt MULTIOS              # Write to multiple descriptors
setopt EXTENDED_GLOB        # Use extended globbing syntax
setopt NO_CLOBBER           # Do not overwrite existing files with > and >>. Use >! and >>! to bypass
