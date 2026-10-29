# Code signing the Windows installer

An unsigned installer makes Windows SmartScreen show "Windows protected your PC" and
a scary publisher warning. Signing removes the "unknown publisher" part; the SmartScreen
reputation warning fades as more people install the signed app (an EV certificate skips it).

The build is already set up to sign. It only needs a certificate, which cannot be created
in code: it is bought from a certificate authority (DigiCert, Sectigo, SSL.com and similar)
or issued by Azure Trusted Signing.

## One-time setup

1. Get a code-signing certificate as a `.pfx` file with a password.
2. Keep the file outside the project folder (never commit it).

## Each release

In PowerShell, in the project folder:

```powershell
$env:CSC_LINK = "C:\secure\easypresent-cert.pfx"
$env:CSC_KEY_PASSWORD = "the certificate password"
npm run build:signed
```

`build:signed` first runs `scripts/check-signing.js`, which stops with a plain message when
the certificate or password is missing, so an unsigned installer is not shipped by mistake.
Then it runs the normal build; electron-builder finds the two variables and signs the
installer and the app executable.

`npm run build` still makes an unsigned installer for your own testing.

## Checking the result

Right-click the installer in `release\`, choose Properties > Digital Signatures: your
organisation should be listed and "This digital signature is OK".

## Not covered

- Azure Trusted Signing needs extra `win.azureSignOptions` settings in package.json.
- Auto-update is not set up, so there is no update signature to verify.
