// Pure (no RN imports) so it runs under `node --test`.
// Maps the .NET CustomerDto (camelCase) to the snake_case user object the screens and
// Redux store were written against (Django CustomerSerializer field names).

const toWallet = wallet =>
  wallet
    ? {
        id: wallet.walletId,
        user_type: wallet.userType,
        wallet_type: wallet.walletType,
        avail_balance: wallet.availBalance,
      }
    : {};

function toLegacyCustomer(dto) {
  if (!dto) {
    return null;
  }
  const ekyc = dto.ekycDetails || {};
  return {
    id: dto.customerId,
    code: dto.code,
    fname: dto.fname,
    mname: dto.mname,
    lname: dto.lname,
    mobile: dto.mobile,
    email: dto.email,
    status: dto.status,
    is_login: dto.isLogin,
    selfie: dto.selfie || '',
    profile_complete: !!dto.profileComplete,
    customer_address: (dto.addresses || []).map(a => ({
      id: a.customerAddressId,
      customer_id: a.customerId,
      type: a.type,
      pretty_type: a.prettyType,
      address: a.address,
      barangay: a.barangay,
      municipality_city: a.municipalityCity,
      province: a.province,
      zip_code: a.zipCode,
      latitude: a.latitude,
      longitude: a.longitude,
    })),
    ekyc_details: {
      id: ekyc.ekycDetailsId ?? null,
      first_name: ekyc.firstName || '',
      middle_name: ekyc.middleName || '',
      last_name: ekyc.lastName || '',
      mobile_no: ekyc.mobileNo || '',
      pretty_mobile_no: ekyc.prettyMobileNo || '',
      selfie: ekyc.selfie || '',
      status: ekyc.status ?? 0,
      source: ekyc.source,
    },
    wallet_details: toWallet(dto.wallet),
    pr_wallet_details: toWallet(dto.pinoyRideWallet),
  };
}

// The store keeps the first address flattened onto the user (as OTPScreen always did).
function toStoredUser(dto) {
  const user = toLegacyCustomer(dto);
  if (!user) {
    return null;
  }
  const flattened = {
    ...user,
    ...(user.customer_address?.[0] || {}),
    id: user.id,
  };
  delete flattened.customer_address;
  return flattened;
}

module.exports = { toLegacyCustomer, toStoredUser };
