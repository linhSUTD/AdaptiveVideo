/**
 * Helper function to create a generic translation table
 * Each normal table that requires translated columns, as coompanied by a sibling translatoin table
 * named <TableName>_Translations, that contains only the translatable columns + few default ones
 * @param tableName		- name of the referenced parent table (ref_id column will point there)
 * @param columns		- list of translatable columns
 * @return {Array}
 */



/**
 * Database Schema for MySQL
 */
var DatabaseSchema =
{
	encryptedView: {

    },
	// Tables to be created
	singular:
	{
		"AutoIncrements":
			[
				"table_name			VARCHAR(32)		NOT NULL",													// name of the table
				"value				BIGINT UNSIGNED	NOT NULL DEFAULT 1"											// AUTO_INCREMENT current value
			],

		"Languages":
			[
				"code				VARCHAR(6)",															// 2 letter language code
				"title				VARCHAR(256)",
				"UNIQUE uq_code (code)"
			],
	},

	// Tables that keep track of versions (create shadowed tables and maintain version consistency)
	// All tables should be shadowed for the audit trail
	//
	// NOTE: Do NOT use DELETE CASCADE, in MySQL triggers do not fire on cascade ref changes so
	// audit trail will be lost! CASCADE is allowed in non-audited tables
	shadowed:
	{
		// Table holding all user information

		"Configuration":
			[
				"lastAutoIncrementExec	DATETIME",
				"lastCurrencyUpdate		DATETIME",
				"MandrillKey			VARCHAR(255)",
				"internalEmailUser		VARCHAR(255)",
				"internalEmailPass		VARCHAR(255)",
				"internalEmailHost		VARCHAR(255)",
				"senderEmail			VARCHAR(255)",
				"senderEmailName		VARCHAR(255)",
				"contactEmail			VARCHAR(255)",
				"homeUrl				VARCHAR(255)"
			],

        "videosUpload":
            [
                "file_name          VARCHAR(255)",
                "file_path          VARCHAR(255)"
            ]


	},

	// Tables not created by the schema ensurer directly
	system:
	{
	},

	// Translation tables are created for specific tables only and contain only translatable rows
	// NOTE: Translations are never removed, they serve as audit trail
	translations:
	{
	}
};


exports.DatabaseSchema = DatabaseSchema;