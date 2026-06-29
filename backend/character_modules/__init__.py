from .syric import get_syric_module, syric_module_allowed


MODULES = {
    "syric_arcane": {
        "id": "syric_arcane",
        "label": "Syric Console",
        "is_allowed": syric_module_allowed,
        "get_payload": get_syric_module,
    },
}


def available_modules_for(user, character):
    modules = []
    for module in MODULES.values():
        if module["is_allowed"](user, character):
            modules.append({
                "id": module["id"],
                "label": module["label"],
            })
    return modules


def get_module_payload(module_id, user, character):
    module = MODULES.get(module_id)
    if not module or not module["is_allowed"](user, character):
        return None
    return module["get_payload"](character)
