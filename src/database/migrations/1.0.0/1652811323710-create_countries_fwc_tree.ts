import { MigrationInterface, QueryRunner } from 'typeorm';
const countries = [
  { name: 'Taiwan', continent: 'AS', code: 'TW' },
  { name: 'Afghanistan', continent: 'AS', code: 'AF' },
  { name: 'Albania', continent: 'EU', code: 'AL' },
  { name: 'Algeria', continent: 'AF', code: 'DZ' },
  { name: 'American Samoa', continent: 'OC', code: 'AS' },
  { name: 'Andorra', continent: 'EU', code: 'AD' },
  { name: 'Angola', continent: 'AF', code: 'AO' },
  { name: 'Anguilla', continent: 'NA', code: 'AI' },
  { name: 'Antarctica', continent: 'AN', code: 'AQ' },
  { name: 'Antigua & Barbuda', continent: 'NA', code: 'AG' },
  { name: 'Argentina', continent: 'SA', code: 'AR' },
  { name: 'Armenia', continent: 'AS', code: 'AM' },
  { name: 'Aruba', continent: 'NA', code: 'AW' },
  { name: 'Australia', continent: 'OC', code: 'AU' },
  { name: 'Austria', continent: 'EU', code: 'AT' },
  { name: 'Azerbaijan', continent: 'AS', code: 'AZ' },
  { name: 'Bahamas', continent: 'NA', code: 'BS' },
  { name: 'Bahrain', continent: 'AS', code: 'BH' },
  { name: 'Bangladesh', continent: 'AS', code: 'BD' },
  { name: 'Barbados', continent: 'NA', code: 'BB' },
  { name: 'Belarus', continent: 'EU', code: 'BY' },
  { name: 'Belgium', continent: 'EU', code: 'BE' },
  { name: 'Belize', continent: 'NA', code: 'BZ' },
  { name: 'Benin', continent: 'AF', code: 'BJ' },
  { name: 'Bermuda', continent: 'NA', code: 'BM' },
  { name: 'Bhutan', continent: 'AS', code: 'BT' },
  { name: 'Bolivia', continent: 'SA', code: 'BO' },
  { name: 'Caribbean Netherlands', continent: 'NA', code: 'BQ' },
  { name: 'Bosnia', continent: 'EU', code: 'BA' },
  { name: 'Botswana', continent: 'AF', code: 'BW' },
  { name: 'Bouvet Island', continent: 'AN', code: 'BV' },
  { name: 'Brazil', continent: 'SA', code: 'BR' },
  { name: 'British Indian Ocean Territory', continent: 'AS', code: 'IO' },
  { name: 'British Virgin Islands', continent: 'NA', code: 'VG' },
  { name: 'Brunei', continent: 'AS', code: 'BN' },
  { name: 'Bulgaria', continent: 'EU', code: 'BG' },
  { name: 'Burkina Faso', continent: 'AF', code: 'BF' },
  { name: 'Burundi', continent: 'AF', code: 'BI' },
  { name: 'Cape Verde', continent: 'AF', code: 'CV' },
  { name: 'Cambodia', continent: 'AS', code: 'KH' },
  { name: 'Cameroon', continent: 'AF', code: 'CM' },
  { name: 'Canada', continent: 'NA', code: 'CA' },
  { name: 'Cayman Islands', continent: 'NA', code: 'KY' },
  { name: 'Central African Republic', continent: 'AF', code: 'CF' },
  { name: 'Chad', continent: 'AF', code: 'TD' },
  { name: 'Chile', continent: 'SA', code: 'CL' },
  { name: 'China', continent: 'AS', code: 'CN' },
  { name: 'Hong Kong', continent: 'AS', code: 'HK' },
  { name: 'Macau', continent: 'AS', code: 'MO' },
  { name: 'Christmas Island', continent: 'OC', code: 'CX' },
  { name: 'Cocos (Keeling) Islands', continent: 'AS', code: 'CC' },
  { name: 'Colombia', continent: 'SA', code: 'CO' },
  { name: 'Comoros', continent: 'AF', code: 'KM' },
  { name: 'Congo - Brazzaville', continent: 'AF', code: 'CG' },
  { name: 'Cook Islands', continent: 'OC', code: 'CK' },
  { name: 'Costa Rica', continent: 'NA', code: 'CR' },
  { name: 'Croatia', continent: 'EU', code: 'HR' },
  { name: 'Cuba', continent: 'NA', code: 'CU' },
  { name: 'Curaçao', continent: 'NA', code: 'CW' },
  { name: 'Cyprus', continent: 'EU', code: 'CY' },
  { name: 'Czechia', continent: 'EU', code: 'CZ' },
  { name: 'Côte d’Ivoire', continent: 'AF', code: 'CI' },
  { name: 'North Korea', continent: 'AS', code: 'KP' },
  { name: 'Congo - Kinshasa', continent: 'AF', code: 'CD' },
  { name: 'Denmark', continent: 'EU', code: 'DK' },
  { name: 'Djibouti', continent: 'AF', code: 'DJ' },
  { name: 'Dominica', continent: 'NA', code: 'DM' },
  { name: 'Dominican Republic', continent: 'NA', code: 'DO' },
  { name: 'Ecuador', continent: 'SA', code: 'EC' },
  { name: 'Egypt', continent: 'AF', code: 'EG' },
  { name: 'El Salvador', continent: 'NA', code: 'SV' },
  { name: 'Equatorial Guinea', continent: 'AF', code: 'GQ' },
  { name: 'Eritrea', continent: 'AF', code: 'ER' },
  { name: 'Estonia', continent: 'EU', code: 'EE' },
  { name: 'Eswatini', continent: 'AF', code: 'SZ' },
  { name: 'Ethiopia', continent: 'AF', code: 'ET' },
  { name: 'Falkland Islands', continent: 'SA', code: 'FK' },
  { name: 'Faroe Islands', continent: 'EU', code: 'FO' },
  { name: 'Fiji', continent: 'OC', code: 'FJ' },
  { name: 'Finland', continent: 'EU', code: 'FI' },
  { name: 'France', continent: 'EU', code: 'FR' },
  { name: 'French Guiana', continent: 'SA', code: 'GF' },
  { name: 'French Polynesia', continent: 'OC', code: 'PF' },
  { name: 'French Southern Territories', continent: 'AN', code: 'TF' },
  { name: 'Gabon', continent: 'AF', code: 'GA' },
  { name: 'Gambia', continent: 'AF', code: 'GM' },
  { name: 'Georgia', continent: 'AS', code: 'GE' },
  { name: 'Germany', continent: 'EU', code: 'DE' },
  { name: 'Ghana', continent: 'AF', code: 'GH' },
  { name: 'Gibraltar', continent: 'EU', code: 'GI' },
  { name: 'Greece', continent: 'EU', code: 'GR' },
  { name: 'Greenland', continent: 'NA', code: 'GL' },
  { name: 'Grenada', continent: 'NA', code: 'GD' },
  { name: 'Guadeloupe', continent: 'NA', code: 'GP' },
  { name: 'Guam', continent: 'OC', code: 'GU' },
  { name: 'Guatemala', continent: 'NA', code: 'GT' },
  { name: 'Guernsey', continent: 'EU', code: 'GG' },
  { name: 'Guinea', continent: 'AF', code: 'GN' },
  { name: 'Guinea-Bissau', continent: 'AF', code: 'GW' },
  { name: 'Guyana', continent: 'SA', code: 'GY' },
  { name: 'Haiti', continent: 'NA', code: 'HT' },
  { name: 'Heard & McDonald Islands', continent: 'AN', code: 'HM' },
  { name: 'Vatican City', continent: 'EU', code: 'VA' },
  { name: 'Honduras', continent: 'NA', code: 'HN' },
  { name: 'Hungary', continent: 'EU', code: 'HU' },
  { name: 'Iceland', continent: 'EU', code: 'IS' },
  { name: 'India', continent: 'AS', code: 'IN' },
  { name: 'Indonesia', continent: 'AS', code: 'ID' },
  { name: 'Iran', continent: 'AS', code: 'IR' },
  { name: 'Iraq', continent: 'AS', code: 'IQ' },
  { name: 'Ireland', continent: 'EU', code: 'IE' },
  { name: 'Isle of Man', continent: 'EU', code: 'IM' },
  { name: 'Israel', continent: 'AS', code: 'IL' },
  { name: 'Italy', continent: 'EU', code: 'IT' },
  { name: 'Jamaica', continent: 'NA', code: 'JM' },
  { name: 'Japan', continent: 'AS', code: 'JP' },
  { name: 'Jersey', continent: 'EU', code: 'JE' },
  { name: 'Jordan', continent: 'AS', code: 'JO' },
  { name: 'Kazakhstan', continent: 'AS', code: 'KZ' },
  { name: 'Kenya', continent: 'AF', code: 'KE' },
  { name: 'Kiribati', continent: 'OC', code: 'KI' },
  { name: 'Kuwait', continent: 'AS', code: 'KW' },
  { name: 'Kyrgyzstan', continent: 'AS', code: 'KG' },
  { name: 'Laos', continent: 'AS', code: 'LA' },
  { name: 'Latvia', continent: 'EU', code: 'LV' },
  { name: 'Lebanon', continent: 'AS', code: 'LB' },
  { name: 'Lesotho', continent: 'AF', code: 'LS' },
  { name: 'Liberia', continent: 'AF', code: 'LR' },
  { name: 'Libya', continent: 'AF', code: 'LY' },
  { name: 'Liechtenstein', continent: 'EU', code: 'LI' },
  { name: 'Lithuania', continent: 'EU', code: 'LT' },
  { name: 'Luxembourg', continent: 'EU', code: 'LU' },
  { name: 'Madagascar', continent: 'AF', code: 'MG' },
  { name: 'Malawi', continent: 'AF', code: 'MW' },
  { name: 'Malaysia', continent: 'AS', code: 'MY' },
  { name: 'Maldives', continent: 'AS', code: 'MV' },
  { name: 'Mali', continent: 'AF', code: 'ML' },
  { name: 'Malta', continent: 'EU', code: 'MT' },
  { name: 'Marshall Islands', continent: 'OC', code: 'MH' },
  { name: 'Martinique', continent: 'NA', code: 'MQ' },
  { name: 'Mauritania', continent: 'AF', code: 'MR' },
  { name: 'Mauritius', continent: 'AF', code: 'MU' },
  { name: 'Mayotte', continent: 'AF', code: 'YT' },
  { name: 'Mexico', continent: 'NA', code: 'MX' },
  { name: 'Micronesia', continent: 'OC', code: 'FM' },
  { name: 'Monaco', continent: 'EU', code: 'MC' },
  { name: 'Mongolia', continent: 'AS', code: 'MN' },
  { name: 'Montenegro', continent: 'EU', code: 'ME' },
  { name: 'Montserrat', continent: 'NA', code: 'MS' },
  { name: 'Morocco', continent: 'AF', code: 'MA' },
  { name: 'Mozambique', continent: 'AF', code: 'MZ' },
  { name: 'Myanmar', continent: 'AS', code: 'MM' },
  { name: 'Namibia', continent: 'AF', code: 'NA' },
  { name: 'Nauru', continent: 'OC', code: 'NR' },
  { name: 'Nepal', continent: 'AS', code: 'NP' },
  { name: 'Netherlands', continent: 'EU', code: 'NL' },
  { name: 'New Caledonia', continent: 'OC', code: 'NC' },
  { name: 'New Zealand', continent: 'OC', code: 'NZ' },
  { name: 'Nicaragua', continent: 'NA', code: 'NI' },
  { name: 'Niger', continent: 'AF', code: 'NE' },
  { name: 'Nigeria', continent: 'AF', code: 'NG' },
  { name: 'Niue', continent: 'OC', code: 'NU' },
  { name: 'Norfolk Island', continent: 'OC', code: 'NF' },
  { name: 'Northern Mariana Islands', continent: 'OC', code: 'MP' },
  { name: 'Norway', continent: 'EU', code: 'NO' },
  { name: 'Oman', continent: 'AS', code: 'OM' },
  { name: 'Pakistan', continent: 'AS', code: 'PK' },
  { name: 'Palau', continent: 'OC', code: 'PW' },
  { name: 'Panama', continent: 'NA', code: 'PA' },
  { name: 'Papua New Guinea', continent: 'OC', code: 'PG' },
  { name: 'Paraguay', continent: 'SA', code: 'PY' },
  { name: 'Peru', continent: 'SA', code: 'PE' },
  { name: 'Philippines', continent: 'AS', code: 'PH' },
  { name: 'Pitcairn Islands', continent: 'OC', code: 'PN' },
  { name: 'Poland', continent: 'EU', code: 'PL' },
  { name: 'Portugal', continent: 'EU', code: 'PT' },
  { name: 'Puerto Rico', continent: 'NA', code: 'PR' },
  { name: 'Qatar', continent: 'AS', code: 'QA' },
  { name: 'South Korea', continent: 'AS', code: 'KR' },
  { name: 'Moldova', continent: 'EU', code: 'MD' },
  { name: 'Romania', continent: 'EU', code: 'RO' },
  { name: 'Russia', continent: 'EU', code: 'RU' },
  { name: 'Rwanda', continent: 'AF', code: 'RW' },
  { name: 'Réunion', continent: 'AF', code: 'RE' },
  { name: 'St. Barthélemy', continent: 'NA', code: 'BL' },
  { name: 'St. Helena', continent: 'AF', code: 'SH' },
  { name: 'St. Kitts & Nevis', continent: 'NA', code: 'KN' },
  { name: 'St. Lucia', continent: 'NA', code: 'LC' },
  { name: 'St. Martin', continent: 'NA', code: 'MF' },
  { name: 'St. Pierre & Miquelon', continent: 'NA', code: 'PM' },
  { name: 'St. Vincent & Grenadines', continent: 'NA', code: 'VC' },
  { name: 'Samoa', continent: 'OC', code: 'WS' },
  { name: 'San Marino', continent: 'EU', code: 'SM' },
  { name: 'São Tomé & Príncipe', continent: 'AF', code: 'ST' },
  { name: 'Saudi Arabia', continent: 'AS', code: 'SA' },
  { name: 'Senegal', continent: 'AF', code: 'SN' },
  { name: 'Serbia', continent: 'EU', code: 'RS' },
  { name: 'Seychelles', continent: 'AF', code: 'SC' },
  { name: 'Sierra Leone', continent: 'AF', code: 'SL' },
  { name: 'Singapore', continent: 'AS', code: 'SG' },
  { name: 'Sint Maarten', continent: 'NA', code: 'SX' },
  { name: 'Slovakia', continent: 'EU', code: 'SK' },
  { name: 'Slovenia', continent: 'EU', code: 'SI' },
  { name: 'Solomon Islands', continent: 'OC', code: 'SB' },
  { name: 'Somalia', continent: 'AF', code: 'SO' },
  { name: 'South Africa', continent: 'AF', code: 'ZA' },
  {
    name: 'South Georgia & South Sandwich Islands',
    continent: 'AN',
    code: 'GS',
  },
  { name: 'South Sudan', continent: 'AF', code: 'SS' },
  { name: 'Spain', continent: 'EU', code: 'ES' },
  { name: 'Sri Lanka', continent: 'AS', code: 'LK' },
  { name: 'Palestine', continent: 'AS', code: 'PS' },
  { name: 'Sudan', continent: 'AF', code: 'SD' },
  { name: 'Suriname', continent: 'SA', code: 'SR' },
  { name: 'Svalbard & Jan Mayen', continent: 'EU', code: 'SJ' },
  { name: 'Sweden', continent: 'EU', code: 'SE' },
  { name: 'Switzerland', continent: 'EU', code: 'CH' },
  { name: 'Syria', continent: 'AS', code: 'SY' },
  { name: 'Tajikistan', continent: 'AS', code: 'TJ' },
  { name: 'Thailand', continent: 'AS', code: 'TH' },
  { name: 'North Macedonia', continent: 'EU', code: 'MK' },
  { name: 'Timor-Leste', continent: 'OC', code: 'TL' },
  { name: 'Togo', continent: 'AF', code: 'TG' },
  { name: 'Tokelau', continent: 'OC', code: 'TK' },
  { name: 'Tonga', continent: 'OC', code: 'TO' },
  { name: 'Trinidad & Tobago', continent: 'NA', code: 'TT' },
  { name: 'Tunisia', continent: 'AF', code: 'TN' },
  { name: 'Turkey', continent: 'AS', code: 'TR' },
  { name: 'Turkmenistan', continent: 'AS', code: 'TM' },
  { name: 'Turks & Caicos Islands', continent: 'NA', code: 'TC' },
  { name: 'Tuvalu', continent: 'OC', code: 'TV' },
  { name: 'Uganda', continent: 'AF', code: 'UG' },
  { name: 'Ukraine', continent: 'EU', code: 'UA' },
  { name: 'United Arab Emirates', continent: 'AS', code: 'AE' },
  { name: 'UK', continent: 'EU', code: 'GB' },
  { name: 'Tanzania', continent: 'AF', code: 'TZ' },
  { name: 'U.S. Outlying Islands', continent: 'OC', code: 'UM' },
  { name: 'U.S. Virgin Islands', continent: 'NA', code: 'VI' },
  { name: 'US', continent: 'NA', code: 'US' },
  { name: 'Uruguay', continent: 'SA', code: 'UY' },
  { name: 'Uzbekistan', continent: 'AS', code: 'UZ' },
  { name: 'Vanuatu', continent: 'OC', code: 'VU' },
  { name: 'Venezuela', continent: 'SA', code: 'VE' },
  { name: 'Vietnam', continent: 'AS', code: 'VN' },
  { name: 'Wallis & Futuna', continent: 'OC', code: 'WF' },
  { name: 'Western Sahara', continent: 'AF', code: 'EH' },
  { name: 'Yemen', continent: 'AS', code: 'YE' },
  { name: 'Zambia', continent: 'AF', code: 'ZM' },
  { name: 'Zimbabwe', continent: 'AF', code: 'ZW' },
  { name: 'Åland Islands', continent: 'EU', code: 'AX' },
];

export class createCountriesFwcTree1652811323710 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const continents = [...new Set(countries.map((item) => item.continent))];

    await queryRunner.query(`INSERT INTO ipobj_type VALUES(22,'GROUP COUNTRIES', NULL)`);

    await queryRunner.query(`INSERT INTO ipobj_type VALUES(23, 'CONTINENT', NULL)`);

    await queryRunner.query(`INSERT INTO ipobj_type VALUES(24, 'COUNTRY', NULL)`);

    await queryRunner.query(
      "INSERT INTO `fwc_tree_node_types` (`node_type`, `obj_type`, `name`) VALUES( 'COF', 22, 'Folder Countries')",
    );

    await queryRunner.query(
      "INSERT INTO `fwc_tree_node_types` (`node_type`, `obj_type`, `name`) VALUES( 'CON', 23, 'Continent Objects Folder')",
    );

    await queryRunner.query(
      "INSERT INTO `fwc_tree_node_types` (`node_type`, `obj_type`, `name`) VALUES( 'COD', 24, 'Country Objects')",
    );

    //Fetch all fwclouds
    const fwClouds = await queryRunner.query(`SELECT id FROM fwcloud`);

    //Create COUNTRIES node in fwc_tree to all fwclouds and create Continents for each COUNTRIES
    for (let i = 0; i < fwClouds.length; i++) {
      await queryRunner.query(
        "INSERT INTO `fwc_tree` (`name`,`id_parent`, `node_type`, `obj_type`,`fwcloud`) VALUES ('COUNTRIES',NULL,'COF',NULL,?)",
        [fwClouds[i].id],
      );
    }

    //Add countries as ipobj
    for (let i = 0; i < countries.length; i++) {
      await queryRunner.query('INSERT INTO `ipobj` (`name`, `type`) VALUES (?, ?)', [
        countries[i].code,
        24,
      ]);
    }

    //Add continents as ipobj_g
    let id = 6;
    for (let i = 0; i < continents.length; i++) {
      await queryRunner.query(
        'INSERT INTO `ipobj_g`(`id`, `name`, `type`, `fwcloud`) VALUES (?, ?, 23, NULL)',
        [id, continents[i]],
      );
      id += 1;
    }

    for (let i = 0; i < countries.length; i++) {
      const idContinent = await queryRunner.query(`SELECT id FROM ipobj_g WHERE name=?`, [
        countries[i].continent,
      ]);
      const idCountry = await queryRunner.query(`SELECT id FROM ipobj WHERE name=?`, [
        countries[i].code,
      ]);
      await queryRunner.query('INSERT INTO `ipobj__ipobjg` (`ipobj_g`, `ipobj`) VALUES (?, ?)', [
        idContinent[0].id,
        idCountry[0].id,
      ]);
    }

    const dataCountries = await queryRunner.query(`SELECT id FROM fwc_tree WHERE node_type='COF'`);

    for (let i = 0; i < dataCountries.length; i++) {
      let id = 6;
      for (let e = 0; e < continents.length; e++) {
        await queryRunner.query(
          "INSERT INTO `fwc_tree`(`name`, `id_parent`,`node_order`,`node_type`, `id_obj`, `obj_type`) VALUES (?, ?, 0, 'CON', ?, 23)",
          [continents[e], dataCountries[i].id, id],
        );
        id += 1;
      }
    }

    for (let i = 0; i < continents.length; i++) {
      //name continent with id and fwcloud
      const idContinent = await queryRunner.query(
        'SELECT `id`, `fwcloud` FROM `fwc_tree` WHERE name=? AND node_type= ?',
        [continents[i], 'CON'],
      );
      //all countries grouped by continents
      const countriesContinent = await queryRunner.query(
        `SELECT i.id, i.name, ig.name as continent FROM ipobj i JOIN ipobj__ipobjg ii ON i.id=ii.ipobj JOIN ipobj_g ig ON ii.ipobj_g = ig.id WHERE ig.name=?`,
        [continents[i]],
      );
      for (let e = 0; e < countriesContinent.length; e++) {
        for (let f = 0; f < idContinent.length; f++) {
          await queryRunner.query(
            'INSERT INTO `fwc_tree` (`name`, `id_parent`, `node_order`, `node_type`, `id_obj`, `obj_type`, `fwcloud`)VALUES(?,?,?,?,?,?,?)',
            [
              countriesContinent[e].name,
              idContinent[f].id,
              0,
              'COD',
              countriesContinent[e].id,
              24,
              idContinent[f].fwcloud,
            ],
          );
        }
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const countryCodes = [...new Set(countries.map((item) => item.code))];

    const continents = [...new Set(countries.map((item) => `'${item.continent}'`))];

    await queryRunner.query(`DELETE FROM fwc_tree WHERE obj_type=?`, [24]);

    await queryRunner.query(
      `DELETE FROM ipobj__ipobjg WHERE ipobj IN (SELECT id FROM ipobj WHERE name IN(${new Array(
        countryCodes.length,
      )
        .fill(' ?')
        .join(',')}
            ))`,
      countryCodes.map((item) => item),
    );

    await queryRunner.query(`DELETE FROM ipobj_g WHERE name IN (${continents.join(', ')}) `);

    countries.forEach((element) => {
      queryRunner.query(`DELETE FROM ipobj WHERE name='${element.code}'`);
    });

    const countriesIds = await queryRunner.query(`SELECT id FROM fwc_tree WHERE node_type='COF'`);

    for (let i = 0; i < countriesIds.length; i++) {
      await queryRunner.query(`DELETE FROM fwc_tree WHERE id_parent=${countriesIds[i].id}`);
    }
    await queryRunner.query(`DELETE FROM fwc_tree WHERE node_type='COF'`);

    await queryRunner.query(`DELETE FROM ipobj_type WHERE id=24`);
    await queryRunner.query(`DELETE FROM ipobj_type WHERE id=23`);
    await queryRunner.query(`DELETE FROM ipobj_type WHERE id=22`);

    await queryRunner.query(`DELETE FROM fwc_tree_node_types WHERE node_type='CON'`);
    await queryRunner.query(`DELETE FROM fwc_tree_node_types WHERE node_type='COF'`);
    await queryRunner.query(`DELETE FROM fwc_tree_node_types WHERE node_type='COD'`);
  }
}
