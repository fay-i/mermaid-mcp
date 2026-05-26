# Behaviors: [Feature Name]

## B001: [Action verb phrase]
**From**: AC-1 | **Depends on**: —
**Action**: [What the system does]
**Input**: [Named inputs with types]
**Output**: [Expected result]
**Test**: Given [precondition], when [action], then [result]

### Branches
- **B001a: [Variant name]**
  Input: [variant input] | Output: [variant output] | Test: [...]
- **B001b: [Variant name]**
  Input: [variant input] | Output: [variant output] | Test: [...]

## B002: [Action verb phrase]
**From**: AC-1 | **Depends on**: B001
**Action**: [What the system does]
**Input**: [Named inputs with types]
**Output**: [Expected result]
**Test**: Given [precondition], when [action], then [result]

---

## Coverage Matrix
| AC | Behaviors |
|----|-----------|
| AC-1 | B001, B002 |
| AC-2 | B003 |
