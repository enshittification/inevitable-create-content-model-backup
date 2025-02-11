import { registerPlugin } from '@wordpress/plugins';
import { PluginDocumentSettingPanel } from '@wordpress/editor';
import { TextControl, Dashicon } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import {
	useLayoutEffect,
	useRef,
	createInterpolateElement,
} from '@wordpress/element';
import { useEntityProp } from '@wordpress/core-data';

const CreateContentModelCptSettings = function () {
	const [ meta, setMeta ] = useEntityProp(
		'postType',
		window.contentModelFields.postType,
		'meta'
	);

	const [ title, setTitle ] = useEntityProp(
		'postType',
		window.contentModelFields.postType,
		'title'
	);

	const lastTitle = useRef( title );

	useLayoutEffect( () => {
		if ( title !== lastTitle.current ) {
			lastTitle.current = title;
			setMeta( { ...meta, plural_label: `${ title }s` } );
		}
	}, [ title, meta, setMeta ] );

	const dashicon = meta.icon.replace( 'dashicons-', '' );

	return (
		<>
			<PluginDocumentSettingPanel
				name="create-content-model-post-settings"
				title={ __( 'Post Type' ) }
				className="create-content-model-post-settings"
			>
				<TextControl
					label={ __( 'Singular Label' ) }
					value={ title }
					onChange={ setTitle }
					help={ __( 'This is synced with the post title' ) }
				/>
				<TextControl
					label={ __( 'Plural Label' ) }
					value={ meta.plural_label }
					onChange={ ( value ) =>
						setMeta( { ...meta, plural_label: value } )
					}
					help={ __(
						'This is the label that will be used for the plural form of the post type'
					) }
				/>
				<div style={ { position: 'relative' } }>
					<TextControl
						label={ __( 'Icon name' ) }
						value={ meta.icon }
						onChange={ ( icon ) => setMeta( { ...meta, icon } ) }
						help={ createInterpolateElement(
							__(
								'The icon for the post type. <a>See reference</a>'
							),
							{
								a: (
									// eslint-disable-next-line jsx-a11y/anchor-has-content
									<a
										target="_blank"
										href="https://developer.wordpress.org/resource/dashicons/"
										rel="noreferrer"
									/>
								),
							}
						) }
					/>
					{ dashicon && (
						<div
							style={ {
								position: 'absolute',
								top: '30px',
								right: '8px',
							} }
						>
							{ ' ' }
							<Dashicon icon={ dashicon } />{ ' ' }
						</div>
					) }
				</div>
			</PluginDocumentSettingPanel>
		</>
	);
};

// Register the plugin.
registerPlugin( 'create-content-model-cpt-settings', {
	render: CreateContentModelCptSettings,
} );
