================================================================================
Encryption
================================================================================

.. toctree::
    :glob:
    :maxdepth: 1

    key-provider
    crypto-provider
    cryptor-unencrypted

To allow extended data security, contents added to DFS can be encrypted before storing them and
decrypted before reading them. To allow this encryption support has been added to the library.

Data is encrypted and stored in so called "Envelopes", which act as container for the data itself
and contain enough information for the API to determine which key to use for decryption and where to
retrieve the key from. If you were wondering why the `descriptions <#description>`_ had the property
`public`, this is the right section for you.

.. code-block:: javascript

    {
      "public": {
        "name": "envelope example"
      },
      "private": "...",
      "cryptoInfo": {
        "algorithm": "unencrypted",
        "keyLength": 256,
        "originator": "0x0000000000000000000000000000000000000001,0x0000000000000000000000000000000000000002",
        "block": 123
      }
    }

The "public" section contains data, that is visible without any knowledge of the encryption key. The
"private" section can only be decrypted if the user that tries to read the data has access to the
encryption key. The `cryptoInfo` part is used to determine which decryption algorithm to use and
where to look for it.

When decrypted, the `private` section takes precedence over the `public` section. This can lead to
the private section overwriting sections of the `public` part. For example a public title may be
replace with a "true" title (only visible for a group of people) from the private section.

The default encryption provided with this module is the example encryption "unencrypted". This
module basically just serializes the incoming data but does not encrypt it.
