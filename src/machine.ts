import { MACHINE_INSTRUCTION_NUMBER, WordValue, MemoryAddress } from "./utils";
import { Memory } from "./memory";
import { Register } from "./register";

abstract class MachineInstruction {
  protected memory!: Memory;
  protected register!: Register;

  abstract evaluate(): number;

  setup(memory: Memory, register: Register) {
    this.memory = memory;
    this.register = register;
  }

  private instructionWord(): WordValue {
    return this.memory.getValueAt(this.register.getProgramCounter());
  }

  protected gR1Value(): number {
    return (this.instructionWord() & 0xF0) >> 4;
  }

  protected gR2OrIRValue(): number {
    return this.instructionWord() & 0xF;
  }

  protected addrValue(): number {
    return this.memory.getValueAt(this.register.getProgramCounter() + 1);
  }

  protected addrIRAddedValue(): number {
    let addr = this.addrValue();
    if (this.gR2OrIRValue() !== 0) {
      addr += this.register.getGRAt(this.gR2OrIRValue());
    }
    return addr;
  }
}

class LD2 extends MachineInstruction {
  evaluate(): number {
    this.register.setGRAt(this.gR1Value(), this.memory.getValueAt(this.addrIRAddedValue()));
    return 2;
  }
}

class ST2 extends MachineInstruction {
  evaluate(): number {
    this.memory.setValueAt(this.addrIRAddedValue(), this.register.getGRAt(this.gR1Value()));
    return 2;
  }
}

class SUBA1 extends MachineInstruction {
  evaluate(): number {
    // TODO: オーバーフロー要考慮
    this.register.setGRAt(this.gR1Value(),
      this.register.getGRAt(this.gR1Value()) - this.register.getGRAt(this.gR2OrIRValue()));
    return 1;
  }
}

class CPA1 extends MachineInstruction {
  evaluate(): number {
    const result = this.register.getGRAt(this.gR1Value()) - this.register.getGRAt(this.gR2OrIRValue());
    if (result > 0) {
      this.register.setFlags(0, 0, 0);
    } else if (result === 0) {
      this.register.setFlags(0, 0, 1);
    } else {
      this.register.setFlags(0, 1, 0);
    }
    return 1;
  }
}

class JUMP2 extends MachineInstruction {
  evaluate(): number {
    this.register.setProgramCounter(this.addrValue());
    return 0;
  }
}

class JZE2 extends MachineInstruction {
  evaluate(): number {
    if (this.register.getZeroFlag() === 1) {
      this.register.setProgramCounter(this.addrValue());
      return 0;
    }
    return 2;
  }
}

class JMI2 extends MachineInstruction {
  evaluate(): number {
    if (this.register.getSignFlag() === 1) {
      this.register.setProgramCounter(this.addrValue());
      return 0;
    }
    return 2;
  }
}

export class Machine {
  constructor(
    private memory: Memory,
    private register: Register,
    private beginAddr: MemoryAddress
  ) {
  }

  execute() {
    this.register.setProgramCounter(this.beginAddr);
    while (true) {
      if (this.instructionNumber() === MACHINE_INSTRUCTION_NUMBER.RET[1]) {
        // TODO: SPの実装のときにここも直す
        break;
      }
      this.executeInstruction();
    }
  }

  private instructionNumber(): number {
    const currentAddress = this.register.getProgramCounter();
    return (this.memory.getValueAt(currentAddress) & 0xFF00) >> 8;
  }

  private executeInstruction() {
    const instructionImpl = Machine.MACHINE_INSTRUCTION_IMPLIMENTATION[this.instructionNumber()];
    if (!instructionImpl) {
      throw new Error(`実装が未定義 ${this.instructionNumber()}`);
    }
    instructionImpl.setup(this.memory, this.register);
    const step = instructionImpl.evaluate();
    if (step === 0) {
      return;
    }
    this.register.setProgramCounter(this.register.getProgramCounter() + step);
  }

  static readonly MACHINE_INSTRUCTION_IMPLIMENTATION: { [key: number]: MachineInstruction } = Object.freeze({
    [MACHINE_INSTRUCTION_NUMBER.LD[2]]: new LD2(),
    [MACHINE_INSTRUCTION_NUMBER.ST[2]]: new ST2(),
    [MACHINE_INSTRUCTION_NUMBER.SUBA[1]]: new SUBA1(),
    [MACHINE_INSTRUCTION_NUMBER.CPA[1]]: new CPA1(),
    [MACHINE_INSTRUCTION_NUMBER.JUMP[2]]: new JUMP2(),
    [MACHINE_INSTRUCTION_NUMBER.JZE[2]]: new JZE2(),
    [MACHINE_INSTRUCTION_NUMBER.JMI[2]]: new JMI2(),
  });
}