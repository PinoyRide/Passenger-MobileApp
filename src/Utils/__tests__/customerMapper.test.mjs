import test from 'node:test';
import assert from 'node:assert/strict';
import mod from '../customerMapper.js';
const { toLegacyCustomer, toStoredUser } = mod;

const dto = {
  customerId: 7,
  code: '000007',
  fname: 'Juan',
  lname: 'Dela Cruz',
  mobile: '639171234567',
  status: 1,
  isLogin: 1,
  addresses: [
    {
      customerAddressId: 41,
      customerId: 7,
      type: '1',
      prettyType: 'Home',
      address: '1 Rizal St',
    },
  ],
  ekycDetails: {
    firstName: 'JUAN',
    lastName: 'DELA CRUZ',
    prettyMobileNo: '+63 917 123 4567',
    selfie: 'https://x/s.jpg',
    source: 'top_ph_ekyc',
  },
  wallet: {
    walletId: 5,
    userType: 'customer',
    walletType: 'user-wallet',
    availBalance: 380.05,
  },
  pinoyRideWallet: null,
};

test('maps the .NET customer to the snake_case fields the screens read', () => {
  const user = toLegacyCustomer(dto);
  assert.equal(user.id, 7);
  assert.equal(user.ekyc_details.first_name, 'JUAN');
  assert.equal(user.ekyc_details.selfie, 'https://x/s.jpg');
  assert.equal(user.wallet_details.avail_balance, 380.05);
  assert.deepEqual(user.pr_wallet_details, {});
  assert.equal(user.customer_address[0].pretty_type, 'Home');
});

test('stored user keeps the customer id when the first address is flattened onto it', () => {
  const user = toStoredUser(dto);
  assert.equal(user.id, 7); // the address id (41) used to overwrite it
  assert.equal(user.address, '1 Rizal St');
  assert.equal(user.customer_address, undefined);
});

test('null in, null out', () => {
  assert.equal(toLegacyCustomer(null), null);
  assert.equal(toStoredUser(undefined), null);
});

test('carries profile completeness and the profile selfie', () => {
  const user = toLegacyCustomer({
    ...dto,
    selfie: 'https://x/me.jpg',
    profileComplete: true,
  });
  assert.equal(user.selfie, 'https://x/me.jpg');
  assert.equal(user.profile_complete, true);
  assert.equal(
    toLegacyCustomer({ ...dto, profileComplete: false }).profile_complete,
    false,
  );
});
