# Open Watcom C/C++ Compiler: 16-bit 8086 Optimisations Report

## Overview

The Open Watcom compiler suite implements a rich set of optimisations targeting the 16-bit 8086 processor on DOS (Disk Operating System). The code generator lives primarily in [bld/cg/](bld/cg/) with Intel-specific code in [bld/cg/intel/](bld/cg/intel/) and 8086-specific code in [bld/cg/intel/i86/](bld/cg/intel/i86/). The C front end is in [bld/cc/](bld/cc/) and the C++ front end in [bld/plusplus/](bld/plusplus/).

The overall optimisation pipeline (in `bld/cg/c/generate.c`, line 681) runs these major passes in order:

1. CFG (Control Flow Graph) normalization and tail recursion
2. **Common subexpression elimination** (CSE) with copy/constant propagation
3. **Loop optimisations**: invariant code motion, induction variable strength reduction, loop enregistration
4. **Multiplication strength reduction** (multiply → shift+add)
5. **Register allocation** (graph-coloring based with scoring)
6. **Peephole optimisation** (merge adjacent operations)
7. **Scoreboarding** (redundant load/store elimination)
8. **Condition code optimisation** (eliminate redundant comparisons)
9. **Instruction scheduling**
10. Encoding and object emission

---

## Key Source File Reference

A quick-reference index of the most important source files used throughout this analysis, organized by subsystem. Use this to orient future exploration.

### Code Generator — Core Optimisation Passes

| File | Lines | Role | Sections |
|------|-------|------|----------|
| `bld/cg/c/generate.c` | 681 | Main optimisation pipeline driver — runs all passes in order | Overview |
| `bld/cg/c/cse.c` | 1636 | Common subexpression elimination, copy propagation, dead code elimination | 7d, 9d |
| `bld/cg/c/loopopts.c` | 3708 | Loop invariant code motion, induction variable strength reduction, loop enregistration | 7e, 9e |
| `bld/cg/c/regalloc.c` | 1366 | Graph-coloring register allocator with scoring | 5b |
| `bld/cg/c/peepopt.c` | 400+ | Peephole optimiser — merges adjacent operations | 7f |
| `bld/cg/c/scmain.c` | 240+ | Scoreboard driver — redundant load/store elimination across basic blocks | 5f, 9c |
| `bld/cg/c/scins.c` | 442 | `ScoreMove()` — deletes redundant loads when register already holds value | 9c |
| `bld/cg/c/scinfo.c` | 414 | `ScoreSame()`, `ScoreStomp()`, `ScoreEqual()` — scoreboard matching and alias invalidation | 9c, 9f |
| `bld/cg/c/scutil.c` | 260+ | `MemChanged()` — invalidates scoreboard entries on function calls | 9c |
| `bld/cg/c/redefby.c` | 404 | `ZapsMemory()`, `ZapsIndexed()`, `IsVolatile()` — aliasing queries | 9e, 9f |
| `bld/cg/c/multiply.c` | 271 | Factor constant multipliers into shift+add sequences | 2b |
| `bld/cg/c/foldins.c` | 447 | Instruction-level constant folding | 7g |
| `bld/cg/c/treefold.c` | 1000+ | Division→shift folding, operand normalization | 2c, 7g |
| `bld/cg/c/inline.c` | 170+ | True function inlining (`BGStartInline`/`BGStopInline`) | 1b |
| `bld/cg/c/split.c` | 726+ | `R_SWAPOPS`, `R_MAKEXORRR` — operand splitting and rewriting | 2f, 2l |
| `bld/cg/c/namelist.c` | 640+ | `SAllocMemory()`, `ScaleIndex()` — name interning (hash-consing) | 9a |
| `bld/cg/c/inssched.c` | 1090 | Instruction scheduler — pipeline reordering, disabled when `OptForSize ≥ 50` | 10f |
| `bld/cg/c/optrel.c` | 310+ | Branch size optimisation — short/near jump selection | 10d |

### Code Generator — Intel / 8086 Specific

| File | Lines | Role | Sections |
|------|-------|------|----------|
| `bld/cg/intel/i86/c/i86table.c` | 1457 | 8086 instruction tables — opcode→generator/verifier/reduction mappings | 2c–2g |
| `bld/cg/intel/i86/c/i86optab.c` | 134 | Type×opcode dispatch matrix | 4b |
| `bld/cg/intel/i86/c/i86enc.c` | 677 | 16-bit instruction encoding, 32-bit shift/negate inline sequences | 2k, 3d, 4a–4d |
| `bld/cg/intel/i86/c/i86splt2.c` | 800+ | `rCYPSHIFT()`, `rBYTESHIFT()` — shift-by-8/16 byte-shuffle reductions | 3a–3c |
| `bld/cg/intel/i86/c/i86rgtbl.c` | 1010 | Register sets, allocation order, `FixedRegs()` | 5a, 5c |
| `bld/cg/intel/i86/c/i86score.c` | 238 | 8086-specific scoreboarding (DS==SS equivalence, CX shift guard) | 5f |
| `bld/cg/intel/i86/c/i86rtrtn.c` | 102+ | Runtime routine inline sequences (switch/case scan) | 2i |
| `bld/cg/intel/i86/h/rg.h` | — | Register constraint definitions per instruction class | 5g |
| `bld/cg/intel/i86/h/_rtinfo.h` | 203 | Runtime library routine table (32-bit/64-bit arith, software float) | 4b, 8 |
| `bld/cg/intel/c/x86enc.c` | 2400+ | Intel-common encoding — `G_TEST`, `G_WORDR1`, `G_LEA`, INC/DEC | 2e, 2g, 2h |
| `bld/cg/intel/c/x86enc2.c` | 750+ | `GenCall()`, `CodeBytes()`, `CodeSequence()` — call/inline-byte emission | 1a |
| `bld/cg/intel/c/x86mul.c` | 127 | `MulCost()`, `ShiftCost()` — CPU-specific multiply/shift cost model | 2b |
| `bld/cg/intel/c/x86ver.c` | 400+ | Verifiers: `V_LEA`, `V_CYP2SHIFT`, `V_BYTESHIFT`, `V_LSHONE`, etc. | 2d, 2h, 3a–3c |
| `bld/cg/intel/c/x86lesds.c` | 421 | `LDS`/`LES` merging, adjacent byte→word store merging | 2j, 7b |
| `bld/cg/intel/c/x86sel.c` | 483 | Switch/case strategy selection (if-chain, jump table, scan table) | 7c |
| `bld/cg/intel/c/x86split.c` | 620+ | `rU_TEST()` — 32-bit comparison reductions, `UseRepForm()` | 4e, 10e |
| `bld/cg/intel/i86/c/i86ilen.c` | 79 | `OptInsSize()`, NOP patterns (`MOV AX,AX` / `CLD`), branch/jump size tables | 10d, 10f |

### C Front End

| File | Lines | Role | Sections |
|------|-------|------|----------|
| `bld/cc/c/cfeinfo.c` | 1185+ | `FEINF_CALL_BYTES` — intrinsic byte sequence lookup, `IF_Lookup()` | 1a, 2a |
| `bld/cc/c/cgen.c` | 1709+ | `IsInLineFunc()`, `DotOperator()` — inlining decisions, OPR_DOT lowering | 1b, 9b |
| `bld/cc/c/cexpr.c` | 2819 | `GenIndex()` — constant array subscript folding to byte offsets | 9b |
| `bld/cc/c/coptions.c` | 1015 | Compiler flag handling (`-oa` → `RELAX_ALIAS`, `-oi`, `-oe`, etc.) | 9f |
| `bld/cc/a/codei86.asm` | 1200+ | Intrinsic inline byte sequences (strlen, memcpy, abs, etc.) | 2a |
| `bld/cc/h/pdefni86.h` | 400+ | Intrinsic tables by memory model | 2a |

### C++ Front End

| File | Lines | Role | Sections |
|------|-------|------|----------|
| `bld/plusplus/c/cgbkcgrf.c` | 1468+ | `MarkFuncsToGen()`, `CgBackFuncInlined()` — call graph inlining | 1b |
| `bld/plusplus/c/cgbkmain.c` | 3216+ | `FEGenProc()` — replays intermediate code for inlined functions | 1b |

### Shared / Headers

| File | Lines | Role | Sections |
|------|-------|------|----------|
| `bld/cg/h/opcodes.h` | 90+ | Opcode definitions, `FIRST_CSE_OP`/`LAST_CSE_OP` ranges | 9d |
| `bld/cg/h/name.h` | 200+ | `name` union — N_MEMORY, N_INDEXED, N_TEMP, N_REGISTER | 9a |
| `bld/cg/h/nclass.h` | — | Name class enum (`N_CONSTANT`, `N_MEMORY`, `N_TEMP`, `N_INDEXED`, `N_REGISTER`) | 9a |
| `bld/cg/h/cgswitch.h` | — | `CGSW_GEN_RELAX_ALIAS`, `CGSW_GEN_FORTRAN_ALIASING` flag definitions | 9f |
| `bld/cg/h/zeropage.h` | — | `ZPageType` enum for indexed-global access modes | 7i |
| `bld/fe_misc/h/callinfo.h` | 47+ | `aux_info` struct — pragmas, byte sequences, register specs | 1a |
| `bld/fe_misc/h/callinfo.c` | 500+ | Watcall/cdecl/pascal calling convention definitions | 5e |
| `bld/hdr/watcom/_comdef.mh` | 211+ | `_WCIRTLINK` macro bridging inline declarations | 2a |

---

## 1. Function Inlining

Open Watcom has **two completely distinct inlining mechanisms**:

### 1a. Aux Byte-Sequence Inlining (`#pragma aux` / intrinsics)

This is used for intrinsic functions (`memcpy`, `strlen`, etc.) and `#pragma aux` functions with inline assembly. A pre-assembled **machine code byte sequence** is emitted verbatim at the call site.

- The `aux_info` structure (defined in `bld/fe_misc/h/callinfo.h`, line 47) carries a `code` field pointing to a `byte_seq` — a raw byte array of machine instructions.
- When the code generator requests `FEINF_CALL_BYTES` from the front end (`bld/cc/c/cfeinfo.c`, line 1185), it receives the byte sequence.
- During encoding, `GenCall()` in `bld/cg/intel/c/x86enc2.c` (line 352) checks for a byte sequence and either calls `CodeBytes()` (simple dump) or `CodeSequence()` (with relocations via `FLOATING_FIXUP_BYTE` markers).

**Parameter passing**: Parameters are loaded into **specific HW (Hardware) registers** before the inline bytes execute — the `parms` field of the pragma definition specifies which parameters go into which registers (e.g., `strlen`: DI=string pointer; `memcpy`: DI=dest, SI=src, CX=count). **No stack frame is created.** The caller arranges register values and the byte sequence operates on them directly.

**Not optimised**: The bytes are emitted verbatim. The code generator treats them as opaque — they bypass all optimisation passes. The only "optimisation" is choosing between different byte sequences for different memory models (small data vs. big data, flat model, `-os` vs `-ot`).

### 1b. True C/C++ Function Inlining (`inline` keyword, `-oe` flag)

This is genuine source-level inlining where the function body is **re-emitted through the code generator** as part of the calling function's IR (Intermediate Representation).

**C compiler path:**

- `IsInLineFunc()` (`bld/cc/c/cgen.c`, line 1709) checks: inline depth < `MAX_INLINE_DEPTH`, function has `FUNC_OK_TO_INLINE`, and function is not recursively in-use.
- The CG (Code Generator) detects `FECALL_GEN_MAKE_CALL_INLINE` in `TNCall()` and calls `BGStartInline()` / `BGStopInline()` (`bld/cg/c/inline.c`, line 92). This calls `FEGenProc()` which asks the front end to re-walk the function's AST (Abstract Syntax Tree) and emit CG API (Application Programming Interface) calls as if the function body were part of the caller.

**C++ compiler path (more sophisticated):**

- `MarkFuncsToGen()` (`bld/plusplus/c/cgbkcgrf.c`, line 1334) builds a **call graph** and considers:
  - `max_inline_depth` (default 3, configurable via `#pragma inline_depth`)
  - Function size (`oe_size` for `-oe` option)
  - Whether static functions are called only once
- `CgBackFuncInlined()` (`bld/plusplus/c/cgbkcgrf.c`, line 1468) is the decision point.
- `FEGenProc()` in the C++ front end (`bld/plusplus/c/cgbkmain.c`, line 3216) replays the intermediate code from a virtual file that was saved during parsing.

**Parameter passing**: Each parameter is **assigned to a temporary** via a `MakeMove` instruction (`bld/cg/c/inline.c`, line 140). The argument expression is evaluated and moved to the temp. The `inline` function's body then references these temps.

**Fully optimised**: The inlined function's intermediate representation is merged into the caller's IR. The full optimisation pipeline (register allocation, CSE, dead code elimination, etc.) runs on the combined code — the optimiser can see through the inline boundary and optimise across it.

### Summary: Two Inlining Mechanisms

| Aspect | Aux Byte Seq (`CALL_BYTES`) | True Inlining (`MAKE_CALL_INLINE`) |
|---|---|---|
| **What's inlined** | Pre-assembled machine code bytes | Function body as CG IR |
| **Used for** | Intrinsics (`memcpy`), `#pragma aux` | `inline` functions, `-oe` |
| **Bytes emitted in place?** | **Yes**, literally | No — IR is merged |
| **Parameter handling** | Loaded into specific HW registers | Assigned to temps via `MakeMove` |
| **Optimised by CG?** | **No** — opaque bytes | **Yes** — full optimisation |
| **Depth control** | N/A (always inlined) | `inline_depth` pragma (default 3) |

---

## 2. Intrinsics and Recognized Code Patterns

### 2a. Intrinsic Functions

When compiling with `-oi` (or `#pragma intrinsic`), the compiler replaces calls to standard library functions with inline machine code. The intrinsic definitions for 16-bit are generated from `bld/cc/a/codei86.asm` into `codei86.gh`, organized into tables by memory model in `bld/cc/h/pdefni86.h`.

The macro `_WCIRTLINK` (`bld/hdr/watcom/_comdef.mh`, lines 207–211) is the bridge: when `-oi` sets `__INLINE_FUNCTIONS__`, declarations tagged with `_WCIRTLINK` use watcall conventions, and `#pragma intrinsic(...)` tells the compiler to replace calls with the corresponding byte sequences.

**String/memory intrinsics** (with model-specific variants for near/far data):

| Function | Implementation | Key technique |
|----------|---------------|---------------|
| `strlen` | `OR CX,-1; XOR AX,AX; REPNZ SCASB; NOT CX; DEC CX` | REP SCASB scan for NUL |
| `memcpy` | `SHR CX,1; REP MOVSW; ADC CX,CX; REP MOVSB` | Word-aligned REP MOVSW with odd-byte fixup |
| `memset` | `MOV AH,AL; SHR CX,1; REP STOSW; ADC CX,CX; REP STOSB` | Byte duplicated to word, then word fill |
| `strcpy` | Unrolled 2-byte-at-a-time copy loop (not REP-based) | Manual loop unrolling |
| `strcmp` | Initial CMPSB fast-path, then REPNZ SCASB + REPZ CMPSB | Two-pass compare |
| `memcmp` | `REPE CMPSB` / `LAHF` | String compare with flag save |
| `movedata` | `PUSH DS; MOV DS,AX; SHR CX,1; REP MOVSW; ADC CX,CX; REP MOVSB; POP DS` | Far segment copy |

**Arithmetic/utility intrinsics**:

| Function | Implementation |
|----------|---------------|
| `abs` | `CWD; XOR AX,DX; SUB AX,DX` (branchless) |
| `labs` | `OR DX,DX; JGE skip; NEG AX; ADC DX,0; NEG DX` |
| `div` | `CWD; IDIV CX` |
| `_rotl` / `_rotr` | `ROL AX,CL` / `ROR AX,CL` |
| `inp` / `inpw` | `IN AL,DX` / `IN AX,DX` |
| `outp` / `outpw` | `OUT DX,AL` / `OUT DX,AX` |
| `_enable` / `_disable` | `STI; CLD` / `CLI` |
| `fabs` | `AND AH,7Fh` (clear sign bit in software float representation) |
| `.min` / `.max` | Branchless min/max sequences |

The intrinsic selection logic in `IF_Lookup()` (`bld/cc/c/cfeinfo.c`, line 210) chooses between 6 different function tables based on memory model (near/far data, DS-floating/pegged) and optimisation preference (size vs speed).

### 2b. Multiplication by Constants → Shift+Add

The compiler performs **algebraic strength reduction** of constant multiplications in `bld/cg/c/multiply.c`. The `Factor()` function decomposes a multiplier into a sequence of shift, add, and subtract operations:

- E.g., `x * 15` → `(x << 4) - x`
- E.g., `x * 10` → `(x << 3) + (x << 1)`

The decomposed sequence is compared against `MulCost()` (`bld/cg/intel/c/x86mul.c`, line 41). On 8086 specifically, the `MUL`/`IMUL` instruction is costed at **120 cycles** — far more expensive than on later CPUs (Central Processing Units) — so the shift+add replacement is almost always profitable.

The `ShiftCost()` function (`bld/cg/intel/c/x86mul.c`, line 105) accounts for 8086 limitations:
- Shift by 1: cost 2 (single SHL instruction)
- Shift by 8: cost 5 (implemented as MOV/XOR byte shuffle — see section 3)
- Shift by N (N ≥ 3): cost `8 + 4*N + 4` (must load CL, then loop)

When `OptForSize > 50`, `MulCost()` returns 1, effectively disabling the transformation in favor of the compact `MUL` instruction.

### 2c. Division by Power of 2 → Shift

Two-phase optimisation:

1. **Tree folding** (`bld/cg/c/treefold.c`, line 870): `FoldDiv()` converts unsigned `x / 2^n` into `x >> n` using `GetLog2()`.
2. **Instruction tables** (`bld/cg/intel/i86/c/i86table.c`, line 568): Signed division by power-of-2 uses special generators that implement the rounding-toward-zero correction needed for signed values:
   - On 286+: `SHL AH,n; SBB AL,AH; SAR AL,n` (via `G_POW2DIV_286`)
   - On 8086: loads CL, then uses shifts through CL (via `G_POW2DIV`)
   - Division by 2 specifically: `SUB AL,AH; SAR AL,1` (via `G_DIV2`)

### 2d. Left Shift by 1 → ADD

The shift tables in `bld/cg/intel/i86/c/i86table.c` (line 690) contain the entry:
```
V_LSHONE → R_ADDRR
```
A left-shift by 1 is converted to `ADD reg,reg`, which has a shorter encoding and takes the same number of cycles.

### 2e. INC/DEC for ±1 and ±2

Addition/subtraction of 1 is replaced with `INC`/`DEC` (1-byte opcode for word registers, via `G_WORDR1`). Addition of 2 is emitted as **double INC** when optimising for size (`V_OP2TWO_SIZE`). See `bld/cg/intel/i86/c/i86table.c`, line 52 and `bld/cg/intel/c/x86enc.c`, line 2031.

### 2f. XOR for Zeroing Registers

`MOV reg,0` is replaced with `XOR reg,reg` via `R_MAKEXORRR` (`bld/cg/c/split.c`, line 663). Recognized in the move tables via `V_OP1ZERO` verifier with `RG_BYTE` or `RG_WORD` target.

### 2g. TEST for Comparison Against Zero

`CMP reg,0` is replaced with `TEST reg,reg` via `G_TEST` (`bld/cg/intel/i86/c/i86table.c`, line 775). The `V_OP2ZERO` verifier triggers this. Additionally, for multi-word tests, partial-word optimisations test only the non-zero half:
- `V_OP2HIGH_B_ZERO` → `R_CYPLOW` (only test low byte)
- `V_OP2LOW_B_ZERO` → `R_CYPHIGH` (only test high byte)
- `V_OP2HIGH_W_ZERO` / `V_OP2LOW_W_ZERO` for 32-bit tests

### 2h. LEA for Address Arithmetic

On 286+ when optimising for speed, the addition of a register and a constant can be done with `LEA` instead of `ADD`, avoiding flag clobbering. The `V_LEA` verifier (`bld/cg/intel/c/x86ver.c`, line 237) enables this.

### 2i. XCHG and XLAT

**XCHG** is **NOT** generated as a general-purpose instruction. It appears only in a single hardcoded byte sequence for the 32-bit switch/case scan routine (`Scn4`) in `bld/cg/intel/i86/c/i86rtrtn.c` (line 102) as opcode `0x92` (`XCHG DX,AX`). The compiler does **not** recognize value-swap patterns and replace them with `XCHG`.

**XLAT** is **never** generated. No reference to XLAT exists anywhere in the code generator. The compiler does not use or recognize XLAT for table lookups.

### 2j. LES/LDS for Loading Far Pointers

The optimiser in `bld/cg/intel/c/x86lesds.c` (line 278) detects two consecutive `MOV` instructions loading a register and a segment register from adjacent memory locations (a far pointer) and merges them into a single `LDS`/`LES`/`LSS`/`LFS`/`LGS` instruction. This saves both code size and cycles.

The same file also merges adjacent byte stores into word stores (line 112) and detects when the scoreboarder has split an `AND AX,imm` into `XOR AH,AH; AND AL,imm` and re-merges them when the split would produce longer code (line 340).

### 2k. LOOP Instruction

The 8086 encoder directly generates the `LOOP` instruction (opcode `0xE2`) combined with `JCXZ` (`0xE3`) for 32-bit multi-bit shift loops (`bld/cg/intel/i86/c/i86enc.c`, line 215). CX is loaded with the iteration count, the body executes, and `LOOP` decrements CX + branches in one instruction.

### 2l. Operand Swapping for Better Encoding

`R_SWAPOPS` (`bld/cg/c/split.c`, line 726) swaps operands when `V_SWAP_GOOD` detects that the left operand is in memory and the right is in a register. This allows the register-operand form of x86 instructions, which is shorter.

---

## 3. Shift-by-8 and Shift-by-16 Optimisations

The compiler implements byte/word-level shuffles as alternatives to expensive multi-bit shifts:

### 3a. 16-bit Shift by 8 (CYP2SHIFT)

The `V_CYP2SHIFT` verifier (`bld/cg/intel/c/x86ver.c`, line 127) triggers for shift-by-8 on a 16-bit value when the CPU is < 186 (no immediate shift) and AX is available. The `rCYPSHIFT()` reduction (`bld/cg/intel/i86/c/i86splt2.c`, line 738) implements this by:

- **Left shift by 8**: Move AL to AH, zero AL (equivalent to `MOV AH,AL; XOR AL,AL`)
- **Right shift by 8**: Move AH to AL, zero AH (equivalent to `MOV AL,AH; XOR AH,AH`)

This avoids 8 iterations of shift-by-1 in a CL loop. The `ShiftCost()` function explicitly costs shift-by-8 at **5** (the MOV+XOR cost), much less than the `8 + 4×8 + 4 = 44` cost of a CL-based loop.

### 3b. 32-bit Shift by 8 (BYTESHIFT)

The `V_BYTESHIFT` verifier (`bld/cg/intel/c/x86ver.c`, line 112) triggers for shift-by-8 on a 32-bit value when the operand is in an ABCD register pair (registers with accessible byte halves). The `rBYTESHIFT()` function (`bld/cg/intel/i86/c/i86splt2.c`, line 781) shuffles individual bytes:

- **Left shift by 8**: Moves each byte one position up within the register pair and zeros the vacated lowest byte.
- **Right shift by 8**: Moves each byte one position down and zeros the vacated highest byte.

This is a direct memory/register access to the high/low byte rather than shifting 8 times.

### 3c. 32-bit Shift by ≥16 (CYP4SHIFT)

The `V_CYP4SHIFT` verifier (`bld/cg/intel/c/x86ver.c`, line 137) triggers for shifts ≥16 bits on 32-bit values. The `rCYPSHIFT()` reduction converts this to:

- **Left shift by N (N ≥ 16)**: Move the low word to the high word (shifted by N−16), zero the low word.
- **Right shift by N (N ≥ 16)**: Move the high word to the low word (shifted by N−16), zero the high word.

This is the "Cross Your Parts" optimisation — a word-sized move plus a smaller shift, instead of 16+ iterations of single-bit shift through a register pair.

### 3d. 32-bit Shift by Small Count (<16, Inline)

For register-resident 32-bit values with shift counts <16 and `OptForSize < 50`, `Do4CXShift()` (`bld/cg/intel/i86/c/i86enc.c`, line 215) generates an **unrolled** sequence using ROL/ROR/XOR/AND instead of the CX/LOOP approach:

```asm
MOV CL, shift_count
SHL high, CL          ; left-shift case
ROL low, CL
XOR low, high
AND low, mask
XOR low, high
```

This avoids the loop overhead for small shifts.

---

## 4. Long (32-bit) Arithmetic on 16-bit

### 4a. Addition and Subtraction

32-bit add/sub is split by `R_SPLITOP` into two 16-bit operations: the low words use regular `ADD`/`SUB`, and the high words use `ADC`/`SBB` (add/subtract with carry). This is handled in the instruction tables at `bld/cg/intel/i86/c/i86table.c`, line 131.

When one half of a constant operand is zero (`V_OP2HIGH_W_ZERO` or `V_OP2LOW_W_ZERO`), the corresponding operation is skipped entirely via `R_CYPHIGH`/`R_CYPLOW` reductions.

### 4b. Multiplication and Division

32-bit multiply and divide are **runtime library calls** on the 8086 — there is no inline code generation for these. The operation table in `bld/cg/intel/i86/c/i86optab.c` (line 53) maps `OP_MUL` (U4/I4) to `RTN4C` and `OP_DIV`/`OP_MOD` to `RTN4`.

The runtime routines are defined in `bld/cg/intel/i86/h/_rtinfo.h`:

| Routine | Symbol | Operation | Left | Right | Result |
|---------|--------|-----------|------|-------|--------|
| `RT_I4M` | `__I4M` | signed mul | DX:AX | CX:BX | DX:AX |
| `RT_U4M` | `__U4M` | unsigned mul | DX:AX | CX:BX | DX:AX |
| `RT_I4D` | `__I4D` | signed div | DX:AX | CX:BX | DX:AX (quotient) |
| `RT_U4D` | `__U4D` | unsigned div | DX:AX | CX:BX | DX:AX (quotient) |
| `RT_I4MOD` | `__I4D` | signed mod | DX:AX | CX:BX | CX:BX (remainder) |
| `RT_U4MOD` | `__U4D` | unsigned mod | DX:AX | CX:BX | CX:BX (remainder) |

Signed and unsigned mod share the same routine name as their div counterpart — the remainder is simply read from CX:BX instead of the quotient in DX:AX.

64-bit operations (I8/U8) similarly use runtime calls (`__I8M`, `__I8DQ`, `__U8M`, `__U8DQ`, etc.) with operands in AX:BX:CX:DX.

### 4c. Negation

32-bit negate is implemented inline. `Gen4RNeg()` (`bld/cg/intel/i86/c/i86enc.c`, line 499) for register pairs:

```asm
NEG high_reg
NEG low_reg
SBB high_reg, 0
```

`Gen4Neg()` (line 520) is the same for memory operands, using `[result+2]` for the high word.

### 4d. Shifts

32-bit shift-by-1 uses the chained shift pattern. `Do4RShift()` (`bld/cg/intel/i86/c/i86enc.c`, line 472):

- Left shift: `SHL low; RCL high`
- Right shift (unsigned): `SHR high; RCR low`
- Right shift (signed): `SAR high; RCR low`

Multi-bit shifts use `Do4CXShift()` with a `MOV CX,count; body; LOOP` construct, or the byte-shuffle/CYP optimisations described in section 3.

### 4e. Comparisons

32-bit comparisons are split: compare high words first, and only if equal, compare low words. For unsigned comparison against zero, `rU_TEST` (`bld/cg/intel/c/x86split.c`, line 620) ORs the two halves together and tests the result.

---

## 5. Register Allocation and Register Pressure

### 5a. Register Hierarchy

The 8086 register sets are defined in `bld/cg/intel/i86/c/i86rgtbl.c`. Key sets and their **iteration/preference order**:

| Class | Registers (in order) |
|-------|---------------------|
| Byte | AL, AH, DL, DH, BL, BH, CL, CH |
| Word | **AX, DX, BX, CX**, SI, DI, BP, SP |
| TwoByte (has byte halves) | AX, DX, BX, CX |
| Index (for addressing) | BX, SI, DI, BP |
| TempIndex (compiler-gen) | SI, DI |
| 32-bit pairs | DX:AX, CX:BX, CX:AX, CX:SI, DX:BX, DI:AX, ... (15 combos) |
| 64-bit quad | AX:BX:CX:DX |

The decomposition rule for 32-bit register pairs (`bld/cg/intel/i86/c/i86rgtbl.c`, line 56):
- **High registers**: CS, SS, ES, DS, CX, DX
- **Low registers**: AX, BX, SI, DI

Index registers (SI, DI) are never used as high halves.

### 5b. Allocation Algorithm

The allocator in `bld/cg/c/regalloc.c` uses an interference-graph approach:

1. **`CalcSavings()`** computes the benefit of allocating each conflict (live range) to a register. Conflicts are sorted by descending savings — highest-value live ranges get first pick.

2. **`GiveBestReg()`** (line 1009) iterates through possible registers and scores each with **`CountRegMoves()`** (line 456):
   - Full score for `MOV temp→reg` or `MOV reg→temp` (eliminates a move)
   - Half score for operations using the temp as an operand in the chosen register
   - Bonus for non-callee-save registers (avoids prolog/epilog save/restore overhead)
   - **Tie-breaking**: prefers registers already in `GivenRegisters` (reuse minimizes interference)

3. **`TooGreedy()`** (line 708) prevents stealing the last index register, last segment register, or the last register needed by any instruction in the conflict's live range. This is a critical safety net against unsolvable register allocation failures.

4. **`WorthProlog()`** checks if the savings justify the callee-save overhead for registers like SI/DI.

### 5c. Fixed and Unalterable Registers

`FixedRegs()` (`bld/cg/intel/i86/c/i86rgtbl.c`, line 904): **SP, BP, SS, CS** are always fixed. DS, ES, FS, GS are fixed unless the corresponding `FLOATING_*` model flag is set.

The set of all registers potentially available for caching: **AX, BX, CX, DX, SI, DI** + segment registers if floating.

### 5d. Return Value Registers

| Type | Return register(s) |
|------|-------------------|
| byte (U1/I1) | AL |
| word (U2/I2) | AX |
| dword (U4/I4) | DX:AX |
| qword (U8/I8) | AX:BX:CX:DX |
| far pointer (CP/PT) | DX:AX |

### 5e. Calling Conventions (Watcall for 16-bit)

Defined in `bld/fe_misc/h/callinfo.c`:

| Convention | Parameters | Callee-saved | Caller cleans stack |
|-----------|-----------|-------------|-------------------|
| `__watcall` | AX, BX, CX, DX (first 4 register-sized, left to right) | All except param/return regs | Callee |
| `__fastcall` | AX, DX, BX | — | — |
| `__cdecl` | All on stack | AX, BX, CX, DX, ES are NOT preserved | Caller |
| `__pascal` | All on stack (left to right) | — | Callee |

### 5f. Register Scoring (Scoreboarding)

The scoreboard (`bld/cg/c/scmain.c`, line 240) tracks which registers hold known values and propagates this information along the control flow graph:

- **`StupidMove()` elimination**: removes `MOV` instructions when the destination already holds the source value.
- **`RemDeadCode()`**: removes writes to dead registers.
- **i86-specific** (`bld/cg/intel/i86/c/i86score.c`, line 60): When DS==SS (flat data model), the scoreboard knows `DS:BX` and `SS:BX` are equivalent — avoiding redundant segment reloads.
- **`ScConvert()`** (line 199): Eliminates CBW/CWD sign-extension when the high part is dead.
- **`CanReplace()`** (line 215): Prevents register substitution for 32-bit shifts where CX is hardwired as the loop counter.

### 5g. Instruction-Level Register Requirements

Specific instructions impose hard register constraints (from `bld/cg/intel/i86/h/rg.h`):

| Operation | Left | Right | Result | Notes |
|-----------|------|-------|--------|-------|
| Word MUL | AX | any word | DX:AX | AX input, DX:AX output |
| Byte MUL | AL | any byte | AX | AL input, AX output |
| Word DIV | DX:AX | any word | AX (quot), DX (rem) | DX:AX input |
| Byte/Word SHIFT | any | CL | same as left | CL is only valid shift count register |
| MOVSW/MOVSB | SI | — | DI | DS:SI → ES:DI |
| SCASB | DI | — | — | ES:DI |
| STOSW | — | — | DI | ES:DI |

---

## 6. Preferred Registers for Inline Assembly

When writing `#pragma aux` inline assembly, the following guidelines minimize conflicts with the register allocator:

### 6a. General Register Preferences

1. **AX, DX, BX, CX** (in that order) are the preferred general-purpose registers — they are the first choices for the `WordRegs` allocator set. Using them for parameters/results aligns with the allocator's natural preferences.

2. **AX** is the accumulator — many 8086 instructions have shorter encodings when using AL/AX (e.g., `IN`, `OUT`, `TEST AL,imm`, `MOV AX,moffs`). It is also the mandatory result register for MUL/DIV and the standard 16-bit return value register.

3. **CX/CL** is required for variable-count shifts and `LOOP`/`REP` prefixed instructions. If your inline code uses these, CX will be contended with code that needs variable shifts or string operations in the same function.

4. **SI and DI** are the string source/destination registers (required for `MOVSB`/`STOSB`/`CMPSB`/`SCASB`). They are also the preferred temp index registers for compiler-generated indexed access.

5. **BX** is the only general-purpose register that can be used as a base register for memory addressing (alongside BP, SI, DI). The 8086 only supports `[BX+SI]`, `[BX+DI]`, `[BP+SI]`, `[BP+DI]`, `[SI]`, `[DI]`, `[BP]`, `[BX]` as addressing modes.

6. **BP** is reserved for the stack frame and is generally not available for allocation.

7. **DX:AX** is the canonical 32-bit register pair. All 32-bit runtime routines expect the first operand in DX:AX and the second in CX:BX.

### 6b. Practical Advice

- **Minimize the `__modify` list**: The `__modify` clause tells the allocator which registers your code clobbers, forcing it to save/restore them. List only the registers you actually modify.
- **Use `__parm` to receive parameters in optimal registers**: Passing values in AX/BX/CX/DX avoids extra MOV instructions since these are the Watcall parameter registers.
- **Use `__modify __exact`** to declare the precise set of modified registers — this gives the allocator maximum freedom.
- **Prefer `__value [__ax]`** for return values — AX is the standard return register and will usually require zero extra MOVs.
- **For 32-bit values, prefer DX:AX** — this is the canonical 32-bit register pair and matches the calling convention.

### 6c. Example: Optimal Pragma Aux Declaration

```c
unsigned int fast_mul10(unsigned int x);
#pragma aux fast_mul10 = \
    "shl ax,1"     /* ax = x*2  */ \
    "mov bx,ax"    /* bx = x*2  */ \
    "shl ax,1"     /* ax = x*4  */ \
    "shl ax,1"     /* ax = x*8  */ \
    "add ax,bx"    /* ax = x*10 */ \
    __parm   [__ax]            \
    __value  [__ax]            \
    __modify __exact [__bx]
```

This takes the parameter in AX (where Watcall would naturally place it), returns in AX (the standard return register), and only clobbers BX — giving the allocator maximum room.

---

## 7. Other Notable Optimisations

### 7a. Block Move Optimisation

`DoRepOp()` (`bld/cg/intel/i86/c/i86enc.c`, line 146): For small structure copies, the compiler emits unrolled `MOVSW` instructions instead of `REP MOVSW`. The threshold is controlled by `UseRepForm()`. For larger copies, it uses `REP MOVSW` with a trailing `MOVSB` for odd bytes. When optimising for size (`OptForSize > 50`), it falls back to `REP MOVSB`.

### 7b. Adjacent Memory Store Merging

`OptMemMove()` (`bld/cg/intel/c/x86lesds.c`, line 112) merges two consecutive byte stores to adjacent addresses into a single word store. On the 8086 (without 386+ support), only byte→word merging is performed.

### 7c. Switch/Case Implementation

The compiler chooses between three strategies based on cost analysis (`bld/cg/intel/c/x86sel.c`):

| Strategy | Minimum entries | Implementation | When used |
|----------|----------------|---------------|-----------|
| **If-chain** | any | Cascading `CMP`/`JE` | Sparse cases, few entries |
| **Jump table** | ≥4 cases | `JMP [table + idx*2]` (12-byte setup) | Dense ranges |
| **Scan table** | ≥7 (word) or ≥5 (dword) | `REPNE SCASW` + parallel label table (12-byte setup) | Moderately dense ranges |

The cost function `Balance()` weighs between code size and execution time based on `OptForSize`.

### 7d. Common Subexpression Elimination

The CSE engine in `bld/cg/c/cse.c` (1636 lines) performs iterative copy propagation, expression-level CSE, dead code elimination, and control flow simplification. It preserves induction variables for the subsequent loop optimisation pass. CSE is called twice during compilation — once before and once after loop optimisation.

### 7e. Loop Optimisations

`bld/cg/c/loopopts.c` (3708 lines) implements:
- **Induction variable recognition**: finds `i = i + c` patterns and derived linear expressions
- **Strength reduction**: replaces array indexing `x[i]` with pointer increments
- **Loop invariant code motion**: hoists invariant computations to a pre-header block
- **Loop enregistration**: moves loop-invariant memory references into registers (processes from innermost loops outward)
- **Dead induction variable elimination**: removes IVs (Induction Variables) whose only use is in comparisons

### 7f. Peephole Optimisations

`bld/cg/c/peepopt.c` collapses adjacent operations:
- Two consecutive `ADD` → single `ADD` with summed constants
- Two consecutive `MUL` → single `MUL` with multiplied constants
- Two consecutive `AND` / `OR` → merged masks
- `AND` followed by `OR` → simplified masks
- `OR` followed by `AND` where AND bits ⊆ OR bits → single `MOV` of the AND constant
- Adjacent shifts → combined shift count

### 7g. Constant Folding

`bld/cg/c/foldins.c` performs instruction-level constant folding for all arithmetic, bitwise, shift, comparison, and conversion operations. It also normalizes operations:
- `SUB t1, k` → `ADD t1, -k` (enables commutative optimisation)
- For commutative ops (ADD, MUL, OR, AND, XOR), constants are moved to the right operand

### 7h. Tail Recursion

`TailRecursion()` is called early in the pipeline to convert tail-recursive calls into jumps.

### 7i. Zero Page / Indexed Globals

The `ZPageType` scheme (`bld/cg/h/zeropage.h`) allows global variable access through base registers (BP, BP+DI, BP+SI) instead of direct addressing, useful for scenarios where DS may not point to the data segment. Five modes are available: `ZP_USES_SS`, `ZP_USES_DS`, `ZP_USES_BP`, `ZP_USES_DI`, `ZP_USES_SI`.

### 7j. Partial-Word Operation Elimination

Throughout the instruction tables, the compiler recognizes when only one half of a multi-word operand needs to be operated on:

| Verifier | Meaning | Optimisation |
|----------|---------|-------------|
| `V_OP2HIGH_W_ZERO` | Upper 16 bits of operand are zero | Skip high-word operation |
| `V_OP2LOW_W_ZERO` | Lower 16 bits are zero | Skip low-word operation |
| `V_OP2HIGH_B_ZERO` | Upper 8 bits are zero | Skip high-byte operation |
| `V_OP2LOW_B_ZERO` | Lower 8 bits are zero | Skip low-byte operation |
| `V_OP2HIGH_W_FFFF` | Upper 16 bits are all ones | Skip AND on high word |
| `V_OP2LOW_W_FFFF` | Lower 16 bits are all ones | Skip AND on low word |

---

## 8. Software Floating-Point Emulation

When the 8087 FPU (Floating-Point Unit) is not present (or not targeted), all floating-point operations are implemented as **runtime library calls**. The full set of routines is defined in `bld/cg/intel/i86/h/_rtinfo.h`:

- **Single-precision**: `__FSA`/`__FSS`/`__FSM`/`__FSD`/`__FSC`/`__FSN` (add/sub/mul/div/cmp/neg)
- **Double-precision**: `__FDA`/`__FDS`/`__FDM`/`__FDD`/`__FDC`/`__FDN`
- **Emulated variants**: `__EDA`/`__EDS`/`__EDM`/`__EDD`/`__EDC`
- **Conversions**: All combinations of I4/U4/I8/U8 ↔ FS/FD/FL, plus FS↔FD↔FL
- **Truncation and rounding**: Both `__FSI4` (truncation) and `__RSI4` (rounding) variants

The `fabs` intrinsic (`AND AH,7Fh`) directly clears the sign bit in the software float representation, avoiding a function call.

---

## 9. Memory Access Caching (Repeated Loads)

A common question when writing performance-sensitive C code targeting the 8086 is whether repeated accesses to the same memory location — such as `arr[1][2]` used multiple times, or `p->v` accessed repeatedly through a struct pointer — are automatically cached in a register by the compiler. The answer depends on the representation of the access, the optimisation passes involved, and the compiler's aliasing model.

### 9a. How Memory Operands Are Represented in the CG IR

The code generator uses a `name` union (`bld/cg/h/name.h`) with several classes (`bld/cg/h/nclass.h`). The ones relevant to memory access caching are:

| Class | IR Name | What it represents | Example source pattern |
|-------|---------|--------------------|-----------------------|
| `N_MEMORY` | `memory_name` | Global/static variable at a fixed symbol+offset | `g_var`, `arr[1][2]` on a global array with constant indices |
| `N_TEMP` | `temp_name` | Local variables and compiler temporaries | `int x` inside a function |
| `N_INDEXED` | `indexed_name` | Memory through base+index+constant displacement | `p->v`, `arr[i][j]`, `*(ptr + n)` |
| `N_REGISTER` | `register_name` | Machine register | `AX`, `SI` |

The `indexed_name` struct carries:
- `index` — the register or temp holding the pointer/index
- `base` — an optional `N_MEMORY` or `N_TEMP` base symbol (if the compiler knows what object is being accessed)
- `constant` — a constant byte displacement (e.g., `offsetof(struct, field)`)
- `scale` — index scale factor
- `index_flags` — includes `X_VOLATILE`

**Name interning (hash-consing)**: All `N_MEMORY` and `N_INDEXED` name objects are **interned** — before allocating a new name, the allocator searches the existing list for a match. `SAllocMemory()` (`bld/cg/c/namelist.c`, line 343) walks `Names[N_MEMORY]` comparing `(symbol, class, offset, type_class)`. `ScaleIndex()` (`bld/cg/c/namelist.c`, line 579) walks `Names[N_INDEXED]` comparing `(base, index, offset, scale, flags, type)` using **pointer equality** on `base` and `index` (which works because those are themselves interned names). This means two references to the same memory location always produce the **same `name*` pointer** — this is critical because CSE and scoreboard matching rely on pointer identity.

### 9b. Front-End Constant Index Folding

When array subscripts are compile-time constants, the C front end folds them into fixed byte offsets **before** the code generator ever sees them.

In `GenIndex()` (`bld/cc/c/cexpr.c`, line 1819), when the subscript is a constant integer (`OPR_PUSHINT`) and the base is a genuine array type (`TYP_ARRAY`):

```c
if( index_expr->op.opr == OPR_PUSHINT
  && tree->u.expr_type->decl_type == TYP_ARRAY ) {
    index_expr->op.u2.long_value *= SizeOfArg( typ );
    tree = ExprNode( tree, OPR_DOT, index_expr );
```

The constant index is multiplied by the element size, and the result becomes an `OPR_DOT` (field-access-style offset) rather than an `OPR_INDEX` (computed subscript). For `arr[1][2]` on e.g. `int arr[3][4]`:

1. `[1]` → `OPR_DOT` with byte offset `1 × sizeof(int[4])` = `1 × 8` = 8
2. `[2]` → `OPR_DOT` with byte offset `2 × sizeof(int)` = `2 × 2` = 4

In the code generator, `OPR_DOT` is lowered to `O_PLUS` with a constant (`bld/cc/c/cgen.c`, line 649), so the CG sees `base + 8 + 4`, which folds to `base + 12` — a single `N_MEMORY` reference at a fixed offset from the array symbol. **No multiply, no index register, no runtime computation.** The access is indistinguishable from a named scalar variable as far as the optimiser is concerned.

If the subscript is **not** a constant, the else branch creates an `OPR_INDEX`, which generates a multiply by element size and an `O_PLUS` — resulting in an `N_INDEXED` name that requires an index register.

### 9c. Scoreboarding — Within-Block Redundant Load Elimination

The **scoreboard** (`bld/cg/c/scmain.c`) is the primary mechanism for caching repeated memory accesses. It operates within a single basic block (straight-line code with no branches), tracking what value each register currently holds.

When `ScoreMove()` (`bld/cg/c/scins.c`, line 323) processes a `MOV mem → reg` instruction:

1. `ScoreInfo()` (`bld/cg/c/scinfo.c`, line 275) extracts identifiers from the source operand — for `N_INDEXED`, this records `base`, `index_reg`, `constant`, and `scale`
2. `ScoreEqual()` (`bld/cg/c/scinfo.c`, line 156) checks whether the destination register **already holds that value** by calling `ScoreLookup()` which iterates the register's score list and calls `ScoreSame()` (line 49) to compare all fields
3. If a match is found, the load instruction is **deleted entirely** (`FreeIns(ins)`) — the register already has the right value
4. If no match, the register is updated to record the new value, and all other registers are scanned to find if any already hold the same value (enabling register-to-register copy instead of a memory load)

For the second access in code like:
```c
x = p->v;      /* MOV [SI+4] → AX   — scoreboard records: AX holds [SI+4] */
/* ... no aliasing writes ... */
y = p->v;      /* MOV [SI+4] → BX   — ScoreEqual finds AX already holds it */
               /*                      replaced with: MOV AX → BX (or deleted) */
```

This works for **both** `N_MEMORY` (global array with constant indices) and `N_INDEXED` (pointer dereferences, computed array accesses).

**Conditions for the scoreboard to cache a load:**

1. **No intervening write to a potentially-aliasing location.** When a store occurs, `ScoreKillInfo()` (`bld/cg/c/scinfo.c`, line 364) calls `ScoreStomp()` (line 72) to determine which cached values might be invalidated. The aliasing model (see 9f) is conservative by default.

2. **No intervening function call.** `MemChanged()` (`bld/cg/c/scutil.c`, line 208) invalidates all scoreboard entries for `SC_N_MEMORY` and `SC_N_INDEXED` when a call occurs (unless the call has `CALL_WRITES_NO_MEMORY`).

3. **Not volatile.** If the `N_INDEXED` name has `X_VOLATILE` set (or an `N_MEMORY`/`N_TEMP` has `VAR_VOLATILE`), the scoreboard records it as `SC_N_VOLATILE`, which **never matches** anything.

4. **Within the same basic block.** The scoreboard propagates forward along single-input-edge chains (a block with exactly one predecessor inherits the predecessor's scoreboard). At merge points (blocks with multiple predecessors), knowledge is discarded.

### 9d. CSE — What It Does and Does Not Cache

Common Subexpression Elimination (`bld/cg/c/cse.c`) handles **arithmetic and conversion operations** (`OP_ADD` through `OP_CONVERT`, defined in `bld/cg/h/opcodes.h`, lines 46 and 62). Bare memory loads (`OP_MOV`) are **not** in this range.

This means:

| Pattern | CSE handles it? |
|---------|----------------|
| `arr[1][2] + 5` computed in two places | **Yes** — the ADD is a CSE candidate; operands match by pointer identity (due to name interning) |
| `x = arr[1][2]; ... y = arr[1][2];` (two bare loads) | **No** — `OP_MOV` is not a CSE opcode; this is the scoreboard's job |
| `arr[i*3+1] + arr[i*3+1]` (index arithmetic) | **Yes** — the `i*3+1` computation is CSE'd, and the indexed name is reused |

Additionally, CSE's "very busy expression" hoisting — which can lift common computations from sibling branches to their common ancestor — explicitly **excludes** expressions with `N_INDEXED` operands (`bld/cg/c/cse.c`, line 720):

```c
if( ins1->operands[0]->n.class != N_INDEXED
  && ins1->operands[i]->n.class != N_INDEXED
  && Hoistable( ins1, NULL )
```

This is a safety restriction: indexed operands might trap or have aliasing concerns that make cross-branch hoisting unsafe.

### 9e. Loop Invariant Code Motion

For repeated accesses **inside a loop**, the loop optimiser (`bld/cg/c/loopopts.c`) can hoist invariant loads to the loop pre-header.

`MarkInvariants()` (line 505) classifies every operand as `VU_INVARIANT` or `VU_VARIANT`. The key function is `InvariantOp()` (line 639):

```c
bool InvariantOp( name *op ) {
    switch( op->n.class ) {
    case N_CONSTANT: return( true );
    case N_MEMORY:
    case N_TEMP:     return( _ChkLoopUsage( op, VU_INVARIANT ) );
    case N_INDEXED:
        if( op->i.index_flags & X_VOLATILE ) return( false );
        if( !InvariantOp( op->i.index ) )    return( false );
        if( op->i.base == NULL )             return( !MemChangedInLoop );
        return( InvariantOp( op->i.base ) );
    }
}
```

The critical constraint is `MemChangedInLoop`, a boolean set to `true` by any of:
- A write to `N_INDEXED` (any pointer store)
- A write to `N_MEMORY` (any global/static store)
- A write to an address-taken `N_TEMP`
- A function call without `CALL_WRITES_NO_MEMORY`

For `N_INDEXED` accesses:
- **With a known base** (e.g., `p->v` where the compiler knows what struct `p` points to): the base must be invariant. If `p` is a loop-invariant local and the struct it points to isn't written inside the loop, the access can be hoisted.
- **With no base (free pointer)** (e.g., `*(ptr + n)` where the compiler has no base symbol): invariant **only if** `MemChangedInLoop` is false — meaning the loop contains no memory writes and no calls whatsoever.

`Hoistable()` (line 700) confirms that `OP_MOV` from an `N_INDEXED` source **is** eligible for hoisting:

```c
case OP_MOV:
case OP_CONVERT:
case OP_ROUND:
    if( ins->operands[0]->n.class != N_INDEXED )
        return( false );
    break;
```

Note: `OP_MOV` from `N_MEMORY` is **not** hoistable (only `N_INDEXED`), because `N_MEMORY` loads are typically cheap direct-address accesses that don't benefit from hoisting.

### 9f. The Aliasing Model and `-oa` / `-of`

Open Watcom has **no separate alias analysis pass**. Aliasing is determined ad-hoc at each optimisation point by `ZapsTheOp()` / `ReDefinedBy()` (`bld/cg/c/redefby.c`) for CSE/loop opts and `ScoreStomp()` (`bld/cg/c/scinfo.c`, line 72) for the scoreboard.

**Default (conservative) aliasing behavior:**

| Store target | What it's assumed to potentially clobber |
|-------------|------------------------------------------|
| Named global (`N_MEMORY`) | Other offsets of the same symbol |
| Through a pointer (`N_INDEXED`, free index) | **All** `N_INDEXED` accesses, **all** `N_MEMORY` globals, and address-taken `N_TEMP`s |
| Through a pointer with known base | Other accesses to the same base |
| Local temp (`N_TEMP`) without address taken | Nothing else |
| Function call | All `N_MEMORY`, all `N_INDEXED`, all address-taken `N_TEMP`s |

This means that **by default, any store through any pointer invalidates cached values for all other pointer-based accesses and all globals.** This is the main reason repeated `p->v` accesses may not be cached — if any other pointer write occurs between them, the scoreboard conservatively discards the cached value.

**`-oa` (`CGSW_GEN_RELAX_ALIAS`)** relaxes this (`bld/cc/c/coptions.c`, line 671). Effects:

| Scenario | Without `-oa` | With `-oa` |
|---------|--------------|------------|
| Store to global, does it clobber free-pointer dereference? | **Yes** | **No** |
| Store to global, does it clobber temp-based indexed access? | **Yes** | **No** |
| Store through free pointer, does it clobber global? | **Yes** | **No** |
| Store through pointer A, does it clobber pointer B (both free)? | **Yes** | **Yes** (unchanged) |

Key locations: `ZapsMemory()` (`bld/cg/c/redefby.c`, line 69) checks `RELAX_ALIAS` at lines 90 and 93; `ZapsIndexed()` (line 180) checks it at lines 208 and 210.

**`-of` (`CGSW_GEN_FORTRAN_ALIASING`)** applies Fortran-style rules: function parameters don't alias each other, and non-`FE_VISIBLE` globals are assumed invariant across calls.

### 9g. Practical Implications — When to Cache Manually

**Scenario 1: `arr[1][2]` with constant indices on a global array**

The front end folds the indices into a fixed offset, producing an `N_MEMORY` reference. This is treated identically to any named global variable. The scoreboard will cache it within a basic block. In a loop, it stays invariant as long as no write to the array (or any pointer store, without `-oa`) occurs.

- **No manual caching needed** in straight-line code with no pointer stores between accesses.
- **Manual caching recommended** in loops that contain function calls or pointer writes (unless `-oa` is used).

**Scenario 2: `p->v` through a struct pointer**

The access becomes `N_INDEXED` with the pointer register as `index`, `offsetof(struct, v)` as the constant displacement, and (if known) the struct variable as `base`. The scoreboard recognizes repeated accesses within a basic block.

- **No manual caching needed** within a basic block with no intervening memory stores or calls.
- **Manual caching recommended** when:
  - Other pointer writes occur between accesses (the scoreboard conservatively assumes they might alias)
  - Function calls occur between accesses
  - The accesses span basic block boundaries (if/else branches, loop iterations)
  - The loop body contains any memory writes or function calls

**Scenario 3: Pointer dereference with no known base (e.g., `*(ptr + offset)`)**

This is the worst case for the optimiser. Without a known base symbol, the compiler cannot prove non-aliasing with anything. Any memory write anywhere invalidates the cached value.

- **Manual caching almost always recommended** unless the code is trivially straight-line with no stores at all.

**Summary table:**

| Pattern | Scoreboard caches within block? | Loop hoisting? | Manual caching needed? |
|---------|-------------------------------|---------------|----------------------|
| `arr[1][2]` (global, const idx, no intervening stores/calls) | **Yes** | **Yes** (if no writes in loop) | No |
| `arr[1][2]` (global, const idx, loop with calls/stores) | Per-block only | **No** (unless `-oa`) | **Yes** |
| `p->v` (no intervening stores/calls) | **Yes** | **Yes** (if base invariant) | No |
| `p->v` (intervening pointer writes or calls) | **No** (invalidated) | **No** | **Yes** |
| `p->v` across basic blocks (if/else) | **No** (merge discards) | N/A | **Yes** |
| `*(ptr + n)` (free pointer, any stores in scope) | **No** | **No** | **Yes** |
| Any access with `volatile` | **Never** | **Never** | **Always** |
| Any pattern + `-oa` flag | Fewer false invalidations | More hoisting possible | Less often needed |

**Practical advice**: When writing performance-critical inner loops, use a local variable to cache any memory access that is read repeatedly — `int cached = p->v;` — and use the cached value. The compiler **will** keep local variables (especially those without their address taken) in registers through the register allocator. This is always safe and often necessary because the aliasing model is conservative. The `-oa` flag helps but cannot eliminate all false aliasing.

---

## 10. The 8088/8086 Prefetch Queue 

The Open Watcom codebase includes a notable example of prefetch queue awareness at the diagnostic level: the `PBus()` routine in `bld/techinfo/pbus.asm` distinguishes the 8088 (4-byte queue, 8-bit bus) from the 8086 (6-byte queue, 16-bit bus) at runtime by using self-modifying code and measuring how many NOP bytes the queue has already fetched past the modification point. However, the compiler's code generator itself makes **no distinction** between the two processors — it targets a generic "i86" that generates identical code for both.

### 10a. Shorter Instruction Encodings

The instruction tables in `bld/cg/intel/i86/c/i86table.c` and the encoding logic in `bld/cg/intel/c/x86enc.c` systematically prefer shorter instruction forms. These are documented individually in earlier sections; the table below collects them with their byte-count impact.

| Optimisation | Longer form | Bytes | Shorter form | Bytes | Saved | Trigger | Section |
|---|---|---|---|---|---|---|---|
| Accumulator short forms (`G_AC`) | `ADD r8,imm8` / `ADD r16,imm16` | 3 / 4 | `ADD AL,imm8` / `ADD AX,imm16` | 2 / 3 | 1 | `RG_BYTE_ACC` / `RG_WORD_ACC` in tables | 6a |
| INC/DEC word register (`G_WORDR1`) | `ADD reg16,1` (83 /0 reg 01) | 3 | `INC reg16` (40+r) | 1 | 2 | `V_OP2ONE` | 2e |
| Double INC/DEC for ±2 | `ADD reg16,2` (83 /0 reg 02) | 3 | `INC reg16; INC reg16` (40+r 40+r) | 2 | 1 | `V_OP2TWO_SIZE` (only when `OptForSize > 50`) | 2e |
| XOR for zero (`R_MAKEXORRR`) | `MOV reg16,0` (B8+r 00 00) | 3 | `XOR reg16,reg16` (33 /r) | 2 | 1 | `V_OP1ZERO` | 2f |
| TEST for CMP 0 (`G_TEST`) | `CMP reg16,0` (83 /7 reg 00) | 3 | `TEST reg16,reg16` (85 /r) | 2 | 1 | `V_OP2ZERO` | 2g |
| Left shift by 1 → ADD (`R_ADDRR`) | `SHL reg16,1` (D1 /4) | 2 | `ADD reg16,reg16` (03 /r) | 2 | 0 | `V_LSHONE` (286+ only, enables LEA combine) | 2d |
| LOOP instruction | `DEC CX` (49) + `JNZ rel8` (75 xx) | 3 | `LOOP rel8` (E2 xx) | 2 | 1 | Hardcoded in `Do4CXShift()` | 2k |
| Operand swap (`R_SWAPOPS`) | `ADD [mem],reg` (01 mod-r/m ...) | 4+ | `ADD reg,[mem]` (03 mod-r/m ...) | 3+ | 1 | `V_SWAP_GOOD` (mem left → reg left saves a byte in many cases) | 2l |

How `G_AC` works: the accumulator short forms (opcodes 04/05, 0C/0D, 14/15, etc.) omit the mod-r/m byte. In the encoding at `bld/cg/intel/c/x86enc.c` (line 1993), `G_AC` backs up the instruction cursor by one (`ICur--; ILen--; IEsc--`) to overwrite the mod-r/m byte that the instruction layer already reserved, then writes only the immediate — saving exactly 1 byte.

The instruction tables are ordered so that shorter encodings are tried first. For example, in the `Add2[]` table at `bld/cg/intel/i86/c/i86table.c` (line 52), the entries are ordered: `V_OP2ONE` → `G_WORDR1` (1-byte INC), then `V_OP2TWO_SIZE` → `G_WORDR1` (double INC, size-only), then `RG_WORD_ACC` → `G_AC` (accumulator short form), then general `G_RC`. The first match wins, so shorter forms are preferred whenever their verifier passes.

### 10b. Branch Size Optimisation

On the 8086, branches have dramatically different byte counts depending on distance:

| Branch type | Short form (bytes) | Near form (bytes) | Saved by short |
|---|---|---|---|
| Unconditional jump (`JMP`) | 2 (`EB rel8`) | 3 (`E9 rel16`) | 1 |
| Conditional branch (`Jcc`) | 2 (`7x rel8`) | 5 (reverse `Jcc` + `JMP rel16`) | 3 |
| CALL | — | 3 (`E8 rel16`) | — |
| Far CALL | — | 5 (`9A seg:off`) | — |

The 8086 does not have the 386's 2-byte `0F 8x rel16` near conditional branch. A near conditional branch must therefore be emitted as a **reversed short branch over a near `JMP`** (5 bytes total: 2 for the reversed Jcc + 3 for JMP). This is encoded in `bld/cg/intel/c/x86esc.c` (line 275). Converting a near conditional to a short conditional therefore saves **3 bytes** — a significant win for the prefetch queue.

The size table is defined by `OptInsSize()` in `bld/cg/intel/i86/c/i86ilen.c` (line 58):

```c
static const byte InsSize[4][OC_DEST_FAR + 1] = {
/*      OC_DEST_SHORT   OC_DEST_NEAR    OC_DEST_CHEAP   OC_DEST_FAR */
{       0,              3,              4,              5 },    /* CALL */
{       2,              3,              0,              5 },    /* JMP */
{       2,              5,              0,              0 },    /* JCOND */
{       2,              4,              0,              0 },    /* JCOND,386 */
};
```

The branch optimiser in `bld/cg/c/optrel.c` (`SetBranches()`, line 232) converts branches to their short forms:

1. **`CanReach()`** (line 60) walks forward (or checks backward) from a branch instruction to its target label, accumulating bytes. If the total is within `MAX_SHORT_FWD` (127 bytes forward) or `MAX_SHORT_BWD` (128 bytes backward), the branch can use the 2-byte short form.

2. **`SetShort()`** (line 192) shrinks the branch instruction's recorded `objlen` from the near size to the short size and records the byte savings.

3. **`BigBranch()`** (line 149) handles the case where a branch cannot reach its target: it tries to jump to a nearby unconditional jump ("jump to a jump"), use an existing redirection label, insert a new trampoline jump, or reverse the condition and add a near jump.

4. When `OptForSize > 50`, the optimiser makes additional effort to reuse redirection labels to keep branches short (`bld/cg/c/optrel.c`, line 263): `else if( OptForSize > 50 && InRange() )` — a label from a previous redirection is reused if it is still within short-branch range, avoiding the need for a near jump.

### 10c. REP String Operations vs. Instruction Loops

The `REP`-prefixed string instructions (`REP MOVSW`, `REP STOSW`, `REP CMPSB`, etc.) execute entirely within the EU, repeating without re-fetching instruction bytes on each iteration. This is a direct prefetch queue benefit: a `REP MOVSW` loop is 2 bytes regardless of iteration count, while an equivalent manual loop (`MOV AX,[SI]; MOV [DI],AX; ADD SI,2; ADD DI,2; LOOP`) would be 10+ bytes fetched repeatedly.

The intrinsic implementations in `bld/cc/a/codei86.asm` (section 2a) exploit this: `memcpy` uses `REP MOVSW` with an odd-byte `MOVSB` fixup, `memset` uses `REP STOSW`, `strlen` uses `REPNZ SCASB`, and `memcmp` uses `REPE CMPSB`. These tight inner loops have near-zero instruction fetch overhead.

The compiler's choice between unrolled `MOVSW` and `REP MOVSW` for structure copies is controlled by `UseRepForm()` in `bld/cg/intel/c/x86split.c` (line 267). The decision considers:

- If the copy is **>10 words**: always use `REP MOVSW` (large enough that startup overhead is amortized)
- If **`OptForSize > 50`** (`-os`): use `REP` form whenever the unrolled form would be longer than `MOV_SIZE + 2` bytes (on 16-bit, `MOV_SIZE` is 3 bytes for `REP MOVSW` + loop overhead)
- Otherwise: a cost model compares `REP` startup cost against per-instruction `MOVSW` cost. On the 8086 (when `!_CPULevel(CPU_486)`), the startup cost is higher, so the threshold for switching to `REP` form is higher

The unrolled form (`DoRepOp()` in `bld/cg/intel/i86/c/i86enc.c`, line 146) emits literal `MOVSW` bytes (1 byte each): for a 6-byte struct, it emits `MOVSW; MOVSW; MOVSW` (3 bytes) instead of `MOV CX,3; REP MOVSW` (4 bytes). For very small copies this is both smaller and faster, but the bytes scale linearly.

When `OptForSize > 50` and the byte count is odd, the compiler simplifies further to `REP MOVSB` (2 bytes for the entire copy), avoiding the separate odd-byte fixup instruction.

### 10d. Code Alignment and NOP Padding

Alignment inserts NOP bytes before a label so that loop headers or procedure entries land on favorable memory addresses. On the 8086 with its 16-bit bus, word-aligned instruction fetches are slightly more efficient (one bus cycle fetches 2 bytes at once; an odd-aligned fetch may require an extra cycle). However, NOP padding bytes must themselves be fetched through the prefetch queue, consuming bus bandwidth to do no useful work.

The `DepthAlign()` function in `bld/cg/intel/c/x86enc2.c` (line 130) controls alignment:

- **When `OptForSize > 0`**: alignment is **disabled** (returns 1, meaning no padding). This covers both `-os` (`OptForSize = 100`) and the default (`OptForSize = 50`). Only `-ot` (`OptForSize = 0`) enables any alignment at all.
- **On pre-386 CPUs with `-ot`**: alignment for procedure entries and deep loops is controlled by the front end's `FEINF_CODE_LABEL_ALIGNMENT` array. Other labels get no alignment (returns 1).
- **On 386**: procedure/deep loop alignment is 4 bytes.
- **On 486+**: procedure/deep loop alignment is 16 bytes.

When NOP padding is inserted, the `DoAlignment()` function in `bld/cg/intel/c/x86esc.c` (line 241) uses the NOP patterns defined for the target. On the 8086, these are defined in `bld/cg/intel/i86/c/i86ilen.c` (line 41):

```c
static const byte   NopList[] = {
    2,                  /* objlen of first NOP pattern */
    0x89, 0xc0,         /* MOV AX,AX */
    0xfc                /* CLD */
};
```

The 2-byte NOP is `MOV AX,AX` (89 C0) — a real instruction that does nothing. The 1-byte NOP is `CLD` (FC) — which clears the direction flag as a side effect, chosen because the calling convention requires DF=0 anyway. The more conventional `NOP` (90h, `XCHG AX,AX`) is not used in the NOP table, though it would be functionally equivalent.

The alignment strategy is correct for the 8088/8086: NOP padding is almost never worthwhile because the fetch cost of the padding bytes outweighs the alignment benefit. The 8086's word-fetch advantage from alignment is at most 4 cycles per misaligned fetch, while each padding byte costs 4 cycles on the 8088 (or 2 cycles on the 8086) to fetch. The compiler defaults to no padding.

### 10e. What the Compiler Does Not Do

Several prefetch-queue-aware optimisations could in theory be implemented but are absent from the Open Watcom code generator:

**No 8088/8086 distinction.** The compiler generates identical code for both processors. It does not account for the 4-byte vs. 6-byte queue size or the 8-bit vs. 16-bit data bus width. The `PBus()` routine in `bld/techinfo/pbus.asm` can detect the bus width at runtime, but the code generator never queries it. There is no `-m8088` or equivalent flag. In practice, code optimised for the 8088's tighter constraints (favoring smaller instructions even more aggressively) would also run well on the 8086, so this is not a significant limitation.

**No instruction-length-aware scheduling.** The instruction scheduler in `bld/cg/c/inssched.c` reorders instructions to minimize pipeline stalls, using a dependency DAG and stall-cost model. It does not consider instruction byte length or model the time the BIU needs to fetch each instruction. On the 8086, where the bus is the bottleneck rather than the execution pipeline, the scheduler is disabled entirely when `OptForSize >= 50` (line 261). Even when enabled (under `-ot`), it optimises for superscalar/pipelined CPUs (486+), not for the 8086's fetch-bound execution model.

**No word-alignment of branch targets.** As discussed in section 10f, the compiler does not align branch targets to even addresses for the 8086's word-aligned fetch benefit. When `OptForSize > 0` (the default and `-os`), all alignment is disabled. Even under `-ot`, only procedure entries and deep loop headers receive alignment — ordinary branch targets within a function are never aligned.

**No `XCHG AX,reg` exploitation.** The 1-byte `XCHG AX,reg16` encoding (opcodes 91–97) is never generated by the code generator except in one hardcoded byte sequence for switch/case scanning (section 2i). The compiler does not recognize register-swap patterns and replace them with `XCHG`, nor does it use `XCHG` to cheaply move values through AX when that would shorten subsequent accumulator-form instructions.

**No `MOV AX,moffs16` preference.** The 3-byte direct-address accumulator load (`A1 addr16`, `MOV AX,[addr]`) is 1 byte shorter than the general form (`8B 06 addr16`, `MOV reg16,[addr]`). The instruction tables and encoding logic do not have a special `G_AC`-style path for move instructions that would prefer routing direct-address loads through AX. The `G_AC` optimisation applies only to ALU operations with immediate operands, not to memory loads.

**No XLAT generation.** The 1-byte `XLAT` instruction (table lookup via `AL = [BX+AL]`) is never generated (section 2i). The compiler does not recognize byte-array-indexed-by-byte patterns as XLAT candidates.

---

## Appendix: Key Source Files Reference

| Area | File | Lines | Description |
|------|------|-------|-------------|
| Optimisation pipeline | `bld/cg/c/generate.c` | 681 | Main code generation driver |
| Multiplication strength reduction | `bld/cg/c/multiply.c` | 271 | Factor const multipliers into shift+add |
| i86 multiplication costs | `bld/cg/intel/c/x86mul.c` | 127 | CPU-specific cost functions |
| i86 instruction tables | `bld/cg/intel/i86/c/i86table.c` | 1457 | Opcode→generator mapping |
| i86 opcode→table dispatch | `bld/cg/intel/i86/c/i86optab.c` | 134 | Type×opcode matrix |
| i86 instruction encoding | `bld/cg/intel/i86/c/i86enc.c` | 677 | 16-bit encodings, 32-bit shift/neg |
| i86 split operations | `bld/cg/intel/i86/c/i86splt2.c` | 800+ | CYPSHIFT, BYTESHIFT reductions |
| Intel verifiers | `bld/cg/intel/c/x86ver.c` | 400+ | V_LEA, V_CYP2SHIFT, V_BYTESHIFT, etc. |
| Intel common encoding | `bld/cg/intel/c/x86enc.c` | 2400+ | G_TEST, G_WORDR1, G_LEA, G_LDSES |
| Intel call encoding | `bld/cg/intel/c/x86enc2.c` | 750+ | GenCall(), CodeBytes(), CodeSequence() |
| LES/LDS optimisation | `bld/cg/intel/c/x86lesds.c` | 421 | Far pointer load merging |
| Switch/case codegen | `bld/cg/intel/c/x86sel.c` | 483 | Jump/scan table generation |
| Register tables (i86) | `bld/cg/intel/i86/c/i86rgtbl.c` | 1010 | Register sets, allocation order |
| Register allocation | `bld/cg/c/regalloc.c` | 1366 | Graph-coloring allocator |
| Register scoring | `bld/cg/intel/i86/c/i86score.c` | 238 | i86-specific scoreboarding |
| CSE | `bld/cg/c/cse.c` | 1636 | Common subexpression elimination |
| Loop optimisation | `bld/cg/c/loopopts.c` | 3708 | Strength reduction, invariant motion |
| Peephole optimiser | `bld/cg/c/peepopt.c` | 400+ | Adjacent operation merging |
| Constant folding | `bld/cg/c/foldins.c` | 447 | Instruction-level const folding |
| Tree folding | `bld/cg/c/treefold.c` | 1000+ | Division→shift, operand folding |
| Inline expansion | `bld/cg/c/inline.c` | 170+ | True function inlining |
| Name interning | `bld/cg/c/namelist.c` | 640+ | SAllocMemory, ScaleIndex dedup |
| Scoreboard moves | `bld/cg/c/scins.c` | 442 | ScoreMove redundant load elim |
| Score info/matching | `bld/cg/c/scinfo.c` | 414 | ScoreSame, ScoreStomp, ScoreEqual |
| Score utilities | `bld/cg/c/scutil.c` | 260+ | MemChanged (call invalidation) |
| Alias / redef checks | `bld/cg/c/redefby.c` | 404 | ZapsMemory, ZapsIndexed, IsVolatile |
| Front-end array index | `bld/cc/c/cexpr.c` | 2819 | GenIndex const-subscript folding |
| i86 runtime routines | `bld/cg/intel/i86/h/_rtinfo.h` | 203 | 32-bit/64-bit/float library calls |
| i86 intrinsic assembly | `bld/cc/a/codei86.asm` | 1200+ | Inline byte sequences |
| i86 pragma definitions | `bld/cc/h/pdefni86.h` | 400+ | Register maps, intrinsic tables |
| Calling conventions | `bld/fe_misc/h/callinfo.c` | 500+ | Watcall/cdecl/pascal setup |
| C inlining decisions | `bld/cc/c/cgen.c` | 1709 | IsInLineFunc() |
| C++ inlining decisions | `bld/plusplus/c/cgbkcgrf.c` | 1334 | MarkFuncsToGen() call graph |
| Instruction size / NOP | `bld/cg/intel/i86/c/i86ilen.c` | 79 | OptInsSize(), NOP patterns, branch size tables |
| Branch size optimisation | `bld/cg/c/optrel.c` | 310+ | Short/near jump selection, redirection |
| Instruction scheduler | `bld/cg/c/inssched.c` | 1090 | Pipeline reordering (disabled for `-os`) |
| Bus width detection | `bld/techinfo/pbus.asm` | 83 | 8088 vs 8086 prefetch queue detection |
