'''
Every API this backend serves, one package per service.

Each service package exposes a ready-to-mount router, so main.py never has to
know how many files that service split its routes across.
'''
