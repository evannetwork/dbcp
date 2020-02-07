================================================================================
Validator
================================================================================

.. list-table:: 
   :widths: auto
   :stub-columns: 1

   * - Class Name
     - Validator
   * - Extends
     - `Logger <../common/logger.html>`_
   * - Source
     - `validator.ts <https://github.com/evannetwork/dbcp/tree/master/src/validator.ts>`_
   * - Examples
     - `validator.spec.ts <https://github.com/evannetwork/dbcp/tree/master/src/validator.spec.ts>`_

The Validator module can be used to verfiy given JSON schemas.

------------------------------------------------------------------------------

.. _validator_constructor:

constructor
================================================================================

.. code-block:: typescript

  new Validator(options);

Creates a new Validator instance.

----------
Parameters
----------

#. ``options`` - ``ValidatorOptions``: options for Validator constructor.
    * ``schema`` - ``any``: the validation schema definition
    * ``log`` - ``Function`` (optional): function to use for logging: ``(message, level) => {...}``
    * ``logLevel`` - |source logLevel|_ (optional): messages with this level will be logged with ``log``
    * ``logLog`` - |source logLogInterface|_ (optional): container for collecting log messages
    * ``logLogLevel`` - |source logLevel|_ (optional): messages with this level will be pushed to ``logLog``

-------
Returns
-------

``Validator`` instance

-------
Example
-------

.. code-block:: typescript
  
  const nameResolver = new Validator({
    schema
  });


--------------------------------------------------------------------------------

.. _validator_isSchemaCorrect:

isSchemaCorrect
===================

.. code-block:: javascript

    Validator.isSchemaCorrect(schema);

Checks if the given ajv schema is correct and returns an array of ajv errors, when the schema is invalid.



----------
Parameters
----------

#. ``schema`` - ``any``: schema to be validated

-------
Returns
-------

``bool`` | |source ajvError|_:  true if data is valid, array of object if validation is failed


--------------------------------------------------------------------------------

.. _validator_validate:

validate
===================

.. code-block:: javascript

    validator.validate(data);

validate a given data object with the instantiated schema



----------
Parameters
----------

#. ``data`` - ``any``: to be validated data

-------
Returns
-------

``bool`` | |source ajvError|_:  true if data is valid, array of object if validation is failed

------------------------------------------------------------------------------

.. _validator_getErrorsAsText:

getErrorsAsText
===================

.. code-block:: javascript

    validator.getErrorsAsText();

returns errors as text if previous validation was failed


-------
Returns
-------

``string``:  all previous validation errors concatenated as readable string


.. required for building markup

.. |source logLevel| replace:: ``LogLevel``
.. _source logLevel: ../common/logger.html#loglevel

.. |source logLogInterface| replace:: ``LogLogInterface``
.. _source logLogInterface: ../common/logger.html#logloginterface

.. |source ajvError| replace:: ``AjvError``
.. _source ajvError: https://github.com/epoberezkin/ajv/blob/master/lib/compile/error_classes.js