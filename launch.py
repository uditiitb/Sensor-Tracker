import subprocess
import webbrowser
import os
import platform

# Function to open a new terminal and run a Python script
def run_script_in_terminal(script_name):
    system_platform = platform.system()

    if system_platform == "Windows":
        # For Windows
        subprocess.Popen(["start", "cmd", "/k", f"python {script_name}"], shell=True)
    elif system_platform == "Darwin":
        # For macOS
        subprocess.Popen(["osascript", "-e", f'tell app "Terminal" to do script "python3 {script_name}"'])
    elif system_platform == "Linux":
        # For Linux
        subprocess.Popen(["gnome-terminal", "--", "python3", script_name])

# Run the two Python scripts in different terminals
run_script_in_terminal("SERVER.py")
run_script_in_terminal('ttn_to_python3.py')

