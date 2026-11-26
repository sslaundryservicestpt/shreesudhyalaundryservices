import { describe, it, expect } from 'vitest';
import {
  requireAdmin,
  requireIdentity,
  canReadScope,
  validateMaster,
  parseMinorUnits,
  type Principal,
} from '../src/index';
const id = '123e4567-e89b-42d3-a456-426614174000';
const supervisor: Principal = {
  id,
  active: true,
  roles: ['SUPERVISOR'],
  scopes: [{ branchId: id }],
};
describe('authoritative access decisions', () => {
  it('denies anonymous and disabled users', () => {
    expect(() => requireIdentity(null)).toThrow('sign in');
    expect(() => requireIdentity({ ...supervisor, active: false })).toThrow('disabled');
  });
  it('denies admin mutations to a supervisor', () => {
    expect(() => requireAdmin(supervisor)).toThrow('administrator');
  });
  it('limits supervisor access to scope', () => {
    expect(canReadScope(supervisor, { branchId: id })).toBe(true);
    expect(canReadScope(supervisor, { branchId: '123e4567-e89b-42d3-a456-426614174001' })).toBe(
      false,
    );
  });
  it('does not give an executive master-data access', () => {
    expect(canReadScope({ ...supervisor, roles: ['DELIVERY_EXECUTIVE'] }, { branchId: id })).toBe(
      false,
    );
  });
  it('requires a role and accepts active admin', () => {
    expect(() => requireIdentity({ ...supervisor, roles: [] })).toThrow('role');
    expect(() => requireAdmin({ ...supervisor, roles: ['ADMIN'] })).not.toThrow();
  });
});
describe('master validation', () => {
  it('requires a valid branch parent', () => {
    expect(() => validateMaster('branches', { name: 'Example branch' })).toThrow('client');
    expect(() => validateMaster('branches', { name: 'Example', clientId: 'not-an-id' })).toThrow();
  });
  it('does not accept actor, identifiers, roles or client-side versions on create', () => {
    expect(() => validateMaster('clients', { name: 'Example', id, roles: ['ADMIN'] })).toThrow();
  });
  it('requires a version on update and validates processing routes', () => {
    expect(() => validateMaster('services', { name: 'Iron only' }, true)).toThrow();
    expect(validateMaster('services', { name: 'Iron only', route: 'IRON_ONLY' })).toMatchObject({
      route: 'IRON_ONLY',
    });
  });
  it('strips unrelated fields before persistence', () => {
    expect(validateMaster('garments', { name: 'Shirt', phone: '111' })).toEqual({ name: 'Shirt' });
  });
});
describe('partial edit semantics', () => {
  it('keeps absent relationship values out of an update and accepts an explicit unassignment', () => {
    expect(validateMaster('branches', { name: 'Updated', version: 1 }, true)).toEqual({
      name: 'Updated',
      version: 1,
    });
    expect(validateMaster('branches', { unitId: '', version: 1 }, true)).toEqual({
      unitId: null,
      version: 1,
    });
  });
});
describe('integer money helper', () => {
  it('parses exact minor units without floating point', () => {
    expect(parseMinorUnits('12.50', 2)).toBe(1250n);
    expect(parseMinorUnits('9007199254740993.01', 2)).toBe(900719925474099301n);
    expect(() => parseMinorUnits('1.001', 2)).toThrow();
    expect(() => parseMinorUnits('-1.00', 2)).toThrow();
  });
});
